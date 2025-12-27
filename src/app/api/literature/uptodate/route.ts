// src/app/api/literature/uptodate/route.ts
// UpToDate connection status and management

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getUpToDateService } from '@/infrastructure/uptodate';

const log = logger.child({ module: 'uptodate-api' });

/**
 * GET /api/literature/uptodate
 * Get UpToDate connection status for the current user
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const upToDateService = getUpToDateService();
    const status = await upToDateService.getStatus(session.user.id);

    return NextResponse.json({ status });
  } catch (error) {
    log.error('Failed to get UpToDate status', { action: 'getStatus' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to get UpToDate status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/literature/uptodate
 * Disconnect UpToDate account
 */
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log.info('Disconnecting UpToDate account', {
      action: 'disconnectUpToDate',
      userId: session.user.id,
    });

    const upToDateService = getUpToDateService();
    const success = await upToDateService.disconnectAccount(session.user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to disconnect account' },
        { status: 400 }
      );
    }

    log.info('UpToDate account disconnected', {
      action: 'disconnectUpToDate',
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to disconnect UpToDate', { action: 'disconnectUpToDate' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to disconnect UpToDate' },
      { status: 500 }
    );
  }
}
