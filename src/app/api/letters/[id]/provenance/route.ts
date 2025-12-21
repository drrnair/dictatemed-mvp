// src/app/api/letters/[id]/provenance/route.ts
// Retrieve provenance record for a letter

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProvenance, formatProvenanceReport } from '@/domains/audit/provenance.service';
import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import { AppError, isAppError } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/letters/:id/provenance - Retrieve provenance record
 *
 * Query parameters:
 * - format: 'json' | 'text' (default: json)
 *
 * Response (JSON):
 * {
 *   id: string;
 *   data: ProvenanceData;
 *   hash: string;
 *   verified: boolean;
 *   createdAt: Date;
 * }
 *
 * Response (text):
 * Human-readable provenance report
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'getProvenance' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: letterId } = await params;

    // Verify user owns the letter
    const letter = await prisma.letter.findFirst({
      where: { id: letterId, userId },
    });

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    // Check if letter is approved (provenance only exists for approved letters)
    if (letter.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Letter not approved - no provenance record exists' },
        { status: 400 }
      );
    }

    // Retrieve provenance
    const provenance = await getProvenance(letterId);

    // Log hash verification failure as warning
    if (!provenance.verified) {
      log.warn('Provenance hash verification failed', {
        letterId,
        provenanceId: provenance.id,
      });
    }

    // Check format preference
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    if (format === 'text') {
      // Return human-readable report
      const report = formatProvenanceReport(provenance.data);

      return new NextResponse(report, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="provenance-${letterId}.txt"`,
        },
      });
    }

    // Return JSON by default
    return NextResponse.json(provenance, { status: 200 });
  } catch (error) {
    log.error(
      'Failed to retrieve provenance',
      {},
      error instanceof Error ? error : undefined
    );

    // Handle AppErrors
    if (isAppError(error)) {
      const statusCode = error.code >= 1001 && error.code <= 1999 ? 401 : 404;
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve provenance' },
      { status: 500 }
    );
  }
}
