// src/app/api/webhooks/resend/route.ts
// Webhook endpoint for Resend delivery status updates

import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
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
 * Verify webhook signature using Svix
 * Returns the verified event payload or null if verification fails
 */
function verifyWebhookSignature(
  payload: string,
  headers: Headers,
  secret: string
): ResendWebhookEvent | null {
  const log = logger.child({ action: 'resendWebhookVerify' });

  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    log.warn('Webhook missing required Svix headers', {
      hasSvixId: Boolean(svixId),
      hasSvixTimestamp: Boolean(svixTimestamp),
      hasSvixSignature: Boolean(svixSignature),
    });
    return null;
  }

  try {
    const wh = new Webhook(secret);
    const verified = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookEvent;

    return verified;
  } catch (error) {
    log.error(
      'Webhook signature verification failed',
      {
        svixId,
        svixTimestamp,
      },
      error instanceof Error ? error : undefined
    );
    return null;
  }
}

/**
 * POST /api/webhooks/resend - Handle Resend webhook events
 *
 * Receives delivery status updates from Resend and updates
 * the sent_emails table accordingly.
 *
 * Security: Verifies webhook signatures using Svix when
 * RESEND_WEBHOOK_SECRET is configured (required in production).
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'resendWebhook' });
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    // Get the raw body for signature verification
    const body = await request.text();

    let event: ResendWebhookEvent;

    // Verify signature when secret is configured
    if (webhookSecret) {
      const verifiedEvent = verifyWebhookSignature(
        body,
        request.headers,
        webhookSecret
      );

      if (!verifiedEvent) {
        // In production, reject invalid signatures
        if (isProduction) {
          return NextResponse.json(
            { error: 'Invalid webhook signature' },
            { status: 401 }
          );
        }
        // In development, log warning but parse manually
        log.warn('Webhook signature verification failed, allowing in dev mode');
        try {
          event = JSON.parse(body) as ResendWebhookEvent;
        } catch (parseError) {
          log.warn('Invalid JSON in webhook payload', {
            error:
              parseError instanceof Error ? parseError.message : String(parseError),
          });
          return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }
      } else {
        event = verifiedEvent;
      }
    } else {
      // No secret configured
      if (isProduction) {
        log.error('RESEND_WEBHOOK_SECRET not configured in production');
        return NextResponse.json(
          { error: 'Webhook endpoint not configured' },
          { status: 500 }
        );
      }
      // Development: parse without verification
      log.warn('RESEND_WEBHOOK_SECRET not configured, skipping verification');
      try {
        event = JSON.parse(body) as ResendWebhookEvent;
      } catch (parseError) {
        log.warn('Invalid JSON in webhook payload', {
          error:
            parseError instanceof Error ? parseError.message : String(parseError),
        });
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
    }

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
