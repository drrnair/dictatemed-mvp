// src/app/api/transcription/webhook/route.ts
// Deepgram transcription webhook handler

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  handleTranscriptionComplete,
  handleTranscriptionError,
} from '@/domains/recording/transcription.service';
import type { TranscriptionResult } from '@/infrastructure/deepgram/types';
import { logger } from '@/lib/logger';

const DEEPGRAM_SECRET_KEY = process.env.DEEPGRAM_WEBHOOK_SECRET;

/**
 * POST /api/transcription/webhook - Handle Deepgram callback
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'transcriptionWebhook' });

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature if secret is configured
    if (DEEPGRAM_SECRET_KEY) {
      const signature = request.headers.get('dg-signature');
      if (!signature) {
        log.warn('Missing webhook signature');
        return NextResponse.json(
          { error: 'Missing signature' },
          { status: 401 }
        );
      }

      const isValid = verifySignature(rawBody, signature, DEEPGRAM_SECRET_KEY);
      if (!isValid) {
        log.warn('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Parse the webhook payload
    const payload = JSON.parse(rawBody);

    // Extract recording ID from metadata or extra field
    const recordingId = extractRecordingId(payload, request);
    if (!recordingId) {
      log.error('Missing recording ID in webhook payload');
      return NextResponse.json(
        { error: 'Missing recording ID' },
        { status: 400 }
      );
    }

    log.info('Received transcription webhook', {
      recordingId,
      requestId: payload.request_id ?? payload.metadata?.request_id,
    });

    // Check for errors in payload
    if (payload.err_code || payload.error) {
      const error = payload.err_msg || payload.error || 'Unknown transcription error';
      await handleTranscriptionError(recordingId, error);
      return NextResponse.json({ status: 'error_handled' });
    }

    // Process successful transcription
    const result: TranscriptionResult = {
      request_id: payload.request_id ?? payload.metadata?.request_id ?? '',
      metadata: payload.metadata ?? {
        request_id: payload.request_id ?? '',
        created: new Date().toISOString(),
        duration: 0,
        channels: 1,
        models: [],
      },
      results: payload.results ?? payload,
    };

    await handleTranscriptionComplete(recordingId, result);

    log.info('Transcription webhook processed', { recordingId });

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    log.error(
      'Failed to process transcription webhook',
      {},
      error instanceof Error ? error : undefined
    );

    // Return 200 to prevent Deepgram from retrying
    // We'll handle the error internally
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Verify Deepgram webhook signature.
 */
function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (_signatureError) {
    // Signature verification failed - could be invalid format or mismatched signature
    return false;
  }
}

/**
 * Extract recording ID from webhook payload or query params.
 */
function extractRecordingId(
  payload: Record<string, unknown>,
  request: NextRequest
): string | null {
  // Check query parameter first (passed in callback URL)
  const url = new URL(request.url);
  const queryId = url.searchParams.get('recordingId');
  if (queryId) {
    return queryId;
  }

  // Check metadata.extra field (if we passed it in the request)
  const metadata = payload.metadata as Record<string, unknown> | undefined;
  if (metadata?.extra) {
    const extra = metadata.extra as Record<string, unknown>;
    if (typeof extra.recordingId === 'string') {
      return extra.recordingId;
    }
  }

  // Check request headers (custom header we might set)
  const headerId = request.headers.get('x-recording-id');
  if (headerId) {
    return headerId;
  }

  return null;
}

/**
 * GET /api/transcription/webhook - Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'transcription-webhook',
  });
}
