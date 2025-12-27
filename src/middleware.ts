// src/middleware.ts
// Next.js middleware for authentication

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0/edge';
import { logger } from '@/lib/logger';

// Routes that don't require authentication
const publicPaths = [
  '/',
  '/signup',
  '/login',
  '/api/auth',
  '/api/health',
  '/api/transcription/webhook',
  '/manifest.json',
  '/sw.js',
  '/icons',
];

// Check if path is public
function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // E2E Test Mode: Skip authentication when E2E_MOCK_AUTH is enabled
  // This allows E2E tests to run without Auth0 authentication
  // CRITICAL SECURITY: Only allow mock auth in development/test environments
  if (process.env.E2E_MOCK_AUTH === 'true') {
    if (process.env.NODE_ENV === 'production') {
      // SECURITY VIOLATION: E2E_MOCK_AUTH should never be enabled in production
      // Log critical error and continue to real auth check (do NOT bypass)
      logger.error('SECURITY VIOLATION: E2E_MOCK_AUTH is enabled in production! Ignoring mock auth and requiring real authentication.', {
        path: pathname,
        timestamp: new Date().toISOString(),
      });
      // Fall through to real auth check below - do NOT return early
    } else {
      // Development/test environment - allow mock auth
      logger.warn('E2E Mock auth enabled for testing', { path: pathname });
      const response = NextResponse.next();
      response.headers.set('X-E2E-Mock-Auth', 'true');
      return response;
    }
  }

  // Check authentication for protected routes
  try {
    const response = NextResponse.next();
    const session = await getSession(request, response);

    if (!session?.user) {
      // Redirect to login for page requests
      if (!pathname.startsWith('/api/')) {
        const loginUrl = new URL('/api/auth/login', request.url);
        loginUrl.searchParams.set('returnTo', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Return 401 for API requests
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return response;
  } catch (error) {
    // Log the authentication error
    logger.warn('Middleware auth error', {
      path: pathname,
      error: error instanceof Error ? error.message : String(error),
    });

    // On error, redirect to login
    if (!pathname.startsWith('/api/')) {
      const loginUrl = new URL('/api/auth/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export const config = {
  // Match all routes except static files and images
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
