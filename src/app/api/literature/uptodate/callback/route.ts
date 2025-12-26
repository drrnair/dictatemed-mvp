// src/app/api/literature/uptodate/callback/route.ts
// UpToDate OAuth callback handler

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getUpToDateService } from '@/infrastructure/uptodate';

const log = logger.child({ module: 'uptodate-api' });

/**
 * GET /api/literature/uptodate/callback
 * Handle OAuth callback from UpToDate
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL('/login?redirect=/settings/integrations', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth error
    if (error) {
      log.warn('UpToDate OAuth error', {
        action: 'oauthCallback',
        userId: session.user.id,
        error,
      });
      return NextResponse.redirect(
        new URL(`/settings/integrations?uptodate_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code) {
      log.warn('UpToDate OAuth missing code', {
        action: 'oauthCallback',
        userId: session.user.id,
      });
      return NextResponse.redirect(
        new URL('/settings/integrations?uptodate_error=missing_code', request.url)
      );
    }

    // Verify state matches user ID (CSRF protection)
    if (state !== session.user.id) {
      log.warn('UpToDate OAuth state mismatch', {
        action: 'oauthCallback',
        userId: session.user.id,
        expectedState: session.user.id,
        receivedState: state,
      });
      return NextResponse.redirect(
        new URL('/settings/integrations?uptodate_error=state_mismatch', request.url)
      );
    }

    // Exchange code for tokens
    const upToDateService = getUpToDateService();
    const success = await upToDateService.connectAccount({
      userId: session.user.id,
      authCode: code,
    });

    if (!success) {
      log.error('UpToDate account connection failed', {
        action: 'oauthCallback',
        userId: session.user.id,
      });
      return NextResponse.redirect(
        new URL('/settings/integrations?uptodate_error=connection_failed', request.url)
      );
    }

    log.info('UpToDate account connected', {
      action: 'oauthCallback',
      userId: session.user.id,
    });

    // Redirect to settings with success message
    return NextResponse.redirect(
      new URL('/settings/integrations?uptodate_connected=true', request.url)
    );
  } catch (error) {
    log.error('UpToDate OAuth callback failed', { action: 'oauthCallback' }, error as Error);
    return NextResponse.redirect(
      new URL('/settings/integrations?uptodate_error=unknown', request.url)
    );
  }
}
