// src/app/api/email/webhook/route.ts
// Webhook endpoint for Resend delivery status updates

import { NextRequest, NextResponse } from 'next/server';
import { updateEmailStatus, type EmailStatus } from '@/infrastructure/email';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

const log = logger.child({ module: 'email-webhook' });

// Resend webhook event types
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked';

interface ResendWebhookPayload {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // Additional fields for specific events
    bounce?: {
      message: string;
    };
    complaint?: {
      feedback_type: string;
    };
  };
}

/**
 * POST /api/email/webhook
 * Receives delivery status updates from Resend.
 *
 * Configure this URL in the Resend dashboard:
 * https://your-domain.com/api/email/webhook
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();
    const payload: ResendWebhookPayload = JSON.parse(rawBody);

    // Verify webhook signature (if configured)
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get('svix-signature');
      const timestamp = request.headers.get('svix-timestamp');
      const webhookId = request.headers.get('svix-id');

      if (!signature || !timestamp || !webhookId) {
        log.warn('Missing webhook signature headers');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      // Verify the signature
      const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedContent)
        .digest('base64');

      // Svix signature format: v1,<base64>
      const signatureVersions = signature.split(' ').map((s) => s.split(',')[1]);
      const isValid = signatureVersions.some((sig) => sig === expectedSignature);

      if (!isValid) {
        log.warn('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      // Check timestamp to prevent replay attacks (5 minute tolerance)
      const webhookTimestamp = parseInt(timestamp, 10) * 1000;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (Math.abs(now - webhookTimestamp) > fiveMinutes) {
        log.warn('Webhook timestamp too old');
        return NextResponse.json({ error: 'Invalid timestamp' }, { status: 401 });
      }
    }

    const { type, data } = payload;
    const messageId = data.email_id;

    log.info('Received email webhook', { type, messageId });

    // Map Resend event types to our status
    const statusMap: Record<ResendEventType, EmailStatus | null> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.delivery_delayed': null, // Don't update status for delays
      'email.complained': 'bounced', // Treat complaints as bounces
      'email.bounced': 'bounced',
      'email.opened': null, // We don't track opens
      'email.clicked': null, // We don't track clicks
    };

    const newStatus = statusMap[type];

    if (newStatus) {
      await updateEmailStatus(messageId, newStatus, {
        eventType: type,
        eventTime: payload.created_at,
        bounce: data.bounce,
        complaint: data.complaint,
      });

      log.info('Email status updated from webhook', { messageId, status: newStatus });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error('Webhook processing error', {}, error as Error);

    // Return 200 to prevent Resend from retrying on parse errors
    // Log the error but don't fail the webhook
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
