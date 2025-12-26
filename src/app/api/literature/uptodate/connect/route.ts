// src/app/api/literature/uptodate/connect/route.ts
// UpToDate OAuth connection initiation

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getUpToDateService } from '@/infrastructure/uptodate';

const log = logger.child({ module: 'uptodate-api' });

/**
 * GET /api/literature/uptodate/connect
 * Get OAuth authorization URL to connect UpToDate account
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const upToDateService = getUpToDateService();

    // Check if UpToDate is enabled
    if (!upToDateService.isEnabled()) {
      return NextResponse.json(
        { error: 'UpToDate integration is not configured' },
        { status: 503 }
      );
    }

    // Get authorization URL
    const authUrl = upToDateService.getAuthorizationUrl(session.user.id);

    if (!authUrl) {
      return NextResponse.json(
        { error: 'Failed to generate authorization URL' },
        { status: 500 }
      );
    }

    log.info('UpToDate auth URL generated', {
      action: 'getAuthUrl',
      userId: session.user.id,
    });

    return NextResponse.json({ authorizationUrl: authUrl });
  } catch (error) {
    log.error('Failed to get UpToDate auth URL', { action: 'getAuthUrl' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to initiate UpToDate connection' },
      { status: 500 }
    );
  }
}
