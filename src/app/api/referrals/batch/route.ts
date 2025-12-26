// src/app/api/referrals/batch/route.ts
// Batch upload endpoint for multiple referral documents

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getSession } from '@/lib/auth';
import { createReferralDocument } from '@/domains/referrals/referral.service';
import {
  ALLOWED_REFERRAL_MIME_TYPES,
  MAX_REFERRAL_FILE_SIZE,
  MAX_BATCH_FILES,
  isAllowedMimeType,
  getAcceptedExtensions,
} from '@/domains/referrals';
import {
  checkRateLimit,
  createRateLimitKey,
  getRateLimitHeaders,
} from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// Schema for a single file in the batch
const batchFileSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_REFERRAL_MIME_TYPES).superRefine((val, ctx) => {
    if (!isAllowedMimeType(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File type not supported. Accepted formats: ${getAcceptedExtensions()}`,
      });
    }
  }),
  sizeBytes: z.number().int().positive().max(MAX_REFERRAL_FILE_SIZE),
});

// Schema for batch upload request
const batchUploadSchema = z.object({
  files: z
    .array(batchFileSchema)
    .min(1, 'At least one file is required')
    .max(MAX_BATCH_FILES, `Maximum ${MAX_BATCH_FILES} files allowed per batch`),
});

// Individual file result in batch response
interface BatchFileResult {
  id: string;
  filename: string;
  uploadUrl: string;
  expiresAt: Date;
}

// Failed file result
interface BatchFileError {
  filename: string;
  error: string;
}

// Batch upload response
interface BatchUploadResponse {
  batchId: string;
  files: BatchFileResult[];
  errors: BatchFileError[];
}

/**
 * POST /api/referrals/batch - Create multiple referral documents and get upload URLs
 *
 * Accepts up to 10 files in a single request, creating document records and
 * returning pre-signed upload URLs for each file.
 *
 * Request body:
 * {
 *   files: [
 *     { filename: "referral.pdf", mimeType: "application/pdf", sizeBytes: 1234567 },
 *     ...
 *   ]
 * }
 *
 * Response:
 * {
 *   batchId: "uuid",
 *   files: [
 *     { id: "uuid", filename: "referral.pdf", uploadUrl: "...", expiresAt: "..." },
 *     ...
 *   ],
 *   errors: [
 *     { filename: "bad.exe", error: "File type not supported" },
 *     ...
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'batchCreateReferrals' });
  const batchId = randomUUID();

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, practiceId } = session.user;

    // Check rate limit - batch counts as multiple requests
    const rateLimitKey = createRateLimitKey(userId, 'referrals');
    const rateLimit = checkRateLimit(rateLimitKey, 'referrals');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const validated = batchUploadSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    const { files } = validated.data;

    log.info('Processing batch upload', {
      batchId,
      fileCount: files.length,
      userId,
      practiceId,
    });

    const results: BatchFileResult[] = [];
    const errors: BatchFileError[] = [];

    // Process files in parallel for efficiency
    // Use Promise.allSettled to handle partial failures
    const promises = files.map(async (file) => {
      try {
        const result = await createReferralDocument(userId, practiceId, {
          filename: file.filename,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
        });

        return {
          success: true as const,
          data: {
            id: result.id,
            filename: file.filename,
            uploadUrl: result.uploadUrl,
            expiresAt: result.expiresAt,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false as const,
          filename: file.filename,
          error: message,
        };
      }
    });

    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          results.push(result.value.data);
        } else {
          errors.push({
            filename: result.value.filename,
            error: result.value.error,
          });
        }
      } else {
        // Promise rejection (shouldn't happen with our try/catch)
        log.error('Unexpected promise rejection in batch upload', {
          reason: result.reason,
        });
      }
    }

    log.info('Batch upload complete', {
      batchId,
      successCount: results.length,
      errorCount: errors.length,
    });

    // If all files failed, return 400
    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          error: 'All files failed to process',
          batchId,
          files: [],
          errors,
        },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const response: BatchUploadResponse = {
      batchId,
      files: results,
      errors,
    };

    // Use 201 if all successful, 207 (Multi-Status) if partial success
    const status = errors.length > 0 ? 207 : 201;

    return NextResponse.json(response, {
      status,
      headers: getRateLimitHeaders(rateLimit),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Handle Supabase storage errors
    if (message.includes('Bucket not found') || message.includes('bucket')) {
      log.error('Storage bucket not configured', { errorMessage: message });
      return NextResponse.json(
        {
          error: 'Document storage is not configured. Please contact support.',
          details: 'The clinical-documents storage bucket may not exist.',
        },
        { status: 503 }
      );
    }

    // Handle authentication/permission errors
    if (message.includes('Invalid API key') || message.includes('JWT') || message.includes('unauthorized')) {
      log.error('Storage authentication failed', { errorMessage: message });
      return NextResponse.json(
        {
          error: 'Document storage authentication failed. Please contact support.',
          details: 'Service role key may be invalid or missing.',
        },
        { status: 503 }
      );
    }

    log.error('Batch upload failed', { batchId, errorMessage: message }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Unable to prepare document uploads. Please try again.',
        batchId,
      },
      { status: 500 }
    );
  }
}
