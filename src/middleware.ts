// src/middleware.ts
// Next.js middleware for authentication

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0/edge';

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
  } catch {
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
