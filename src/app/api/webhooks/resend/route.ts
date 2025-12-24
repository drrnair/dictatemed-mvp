// src/app/api/webhooks/resend/route.ts
// Webhook endpoint for Resend delivery status updates

import { NextRequest, NextResponse } from 'next/server';
import { updateEmailStatus, type EmailStatus } from '@/infrastructure/email';
import { logger } from '@/lib/logger';

/**
 * Resend webhook event types
 * @see https://resend.com/docs/dashboard/webhooks/event-types
 */
interface ResendWebhookEvent {
  type: string;
  data: {
    email_id: string;
    to: string[];
    from: string;
    subject: string;
    created_at: string;
    // Additional fields vary by event type
    [key: string]: unknown;
  };
}

/**
 * Map Resend event types to our email status
 */
const eventToStatus: Record<string, EmailStatus> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'bounced', // Treat spam complaints as bounces
  'email.delivery_delayed': 'sent', // Still pending delivery
};

/**
 * POST /api/webhooks/resend - Handle Resend webhook events
 *
 * Receives delivery status updates from Resend and updates
 * the sent_emails table accordingly.
 *
 * Note: In production, you should verify the webhook signature
 * using RESEND_WEBHOOK_SECRET. For MVP, we accept all events
 * but log verification warnings.
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'resendWebhook' });

  try {
    // Get the raw body for signature verification
    const body = await request.text();
    let event: ResendWebhookEvent;

    try {
      event = JSON.parse(body) as ResendWebhookEvent;
    } catch {
      log.warn('Invalid JSON in webhook payload');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Signature verification (optional for MVP)
    const signature = request.headers.get('svix-signature');
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (webhookSecret && !signature) {
      log.warn('Missing webhook signature');
      // In production, you should reject requests without valid signatures
      // For MVP, we log and continue
    }

    // TODO: Implement actual signature verification using Svix
    // See: https://resend.com/docs/dashboard/webhooks/verify-webhooks
    // Note: The secret needs to be base64-decoded before use with Svix

    if (!event.type || !event.data?.email_id) {
      log.warn('Malformed webhook event', { event });
      return NextResponse.json({ error: 'Invalid event format' }, { status: 400 });
    }

    const messageId = event.data.email_id;
    const eventType = event.type;

    log.info('Received Resend webhook', {
      eventType,
      messageId,
    });

    // Map event type to status
    const status = eventToStatus[eventType];

    if (status) {
      await updateEmailStatus(messageId, status, {
        eventType,
        timestamp: event.data.created_at,
        to: event.data.to,
        from: event.data.from,
        subject: event.data.subject,
        rawEvent: event.data,
      });

      log.info('Email status updated from webhook', {
        messageId,
        status,
        eventType,
      });
    } else {
      // Log unknown event types for monitoring
      log.info('Unhandled Resend event type', { eventType, messageId });
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    log.error(
      'Webhook processing failed',
      {},
      error instanceof Error ? error : undefined
    );

    // Return 200 anyway to prevent Resend from retrying
    // Log the error for investigation
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

/**
 * GET /api/webhooks/resend - Health check for webhook endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'resend-webhook',
    configured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
  });
}
