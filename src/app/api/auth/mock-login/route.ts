// src/app/api/auth/mock-login/route.ts
// Mock authentication endpoint for E2E tests
//
// This endpoint creates a valid Auth0 session for E2E testing without
// requiring actual Auth0 login. Only available when E2E_MOCK_AUTH=true.
//
// SECURITY: This endpoint is disabled by default and only enabled in CI
// environments with the E2E_MOCK_AUTH environment variable.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jose from 'jose';

// E2E test user credentials - must match seed-e2e-test-data.ts
const E2E_TEST_USER = {
  sub: 'auth0|e2e-test-clinician',
  email: 'test.cardiologist+e2e@dictatemed.dev',
  name: 'Dr. TEST E2E Cardiologist',
  nickname: 'test.cardiologist',
  picture: 'https://s.gravatar.com/avatar/e2e-test',
  updated_at: new Date().toISOString(),
  email_verified: true,
};

/**
 * POST /api/auth/mock-login
 *
 * Creates a mock Auth0 session for E2E tests.
 * Only works when E2E_MOCK_AUTH environment variable is set to 'true'.
 */
export async function POST(request: NextRequest) {
  // Security check: Only allow mock auth in E2E test mode
  if (process.env.E2E_MOCK_AUTH !== 'true') {
    return NextResponse.json(
      {
        error: 'Mock authentication is disabled',
        message: 'Set E2E_MOCK_AUTH=true to enable mock authentication for E2E tests',
      },
      { status: 403 }
    );
  }

  try {
    // Get the Auth0 secret for cookie encryption
    const secret = process.env.AUTH0_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'AUTH0_SECRET not configured' },
        { status: 500 }
      );
    }

    // Create session data matching Auth0's session structure
    const sessionData = {
      user: E2E_TEST_USER,
      accessToken: 'mock-access-token-for-e2e-tests',
      accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      idToken: 'mock-id-token-for-e2e-tests',
    };

    // Encrypt the session using the same method as @auth0/nextjs-auth0
    // The SDK uses JWE with A256GCM encryption
    const secretKey = new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32));
    const jwe = await new jose.EncryptJWT(sessionData)
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .encrypt(secretKey);

    // Set the session cookie
    // Auth0 SDK uses 'appSession' as the default cookie name
    const cookieStore = await cookies();
    cookieStore.set('appSession', jwe, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400, // 24 hours
    });

    // Return success with redirect URL
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/dashboard';

    return NextResponse.json({
      success: true,
      message: 'Mock authentication successful',
      user: {
        email: E2E_TEST_USER.email,
        name: E2E_TEST_USER.name,
      },
      returnTo,
    });
  } catch (error) {
    console.error('Mock login error:', error);
    return NextResponse.json(
      {
        error: 'Mock authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/mock-login
 *
 * Creates a mock Auth0 session and redirects to the dashboard.
 * This is the preferred method for E2E tests as it works with page.goto().
 *
 * Usage: page.goto('/api/auth/mock-login?redirect=/dashboard')
 */
export async function GET(request: NextRequest) {
  const isEnabled = process.env.E2E_MOCK_AUTH === 'true';
  const shouldRedirect = request.nextUrl.searchParams.get('redirect');

  // If no redirect param, just return status (for checking availability)
  if (!shouldRedirect) {
    return NextResponse.json({
      mockAuthEnabled: isEnabled,
      message: isEnabled
        ? 'Mock authentication is available. Add ?redirect=/dashboard to create session and redirect.'
        : 'Mock authentication is disabled. Set E2E_MOCK_AUTH=true to enable.',
    });
  }

  // Security check: Only allow mock auth in E2E test mode
  if (!isEnabled) {
    return NextResponse.json(
      {
        error: 'Mock authentication is disabled',
        message: 'Set E2E_MOCK_AUTH=true to enable mock authentication for E2E tests',
      },
      { status: 403 }
    );
  }

  try {
    // Get the Auth0 secret for cookie encryption
    const secret = process.env.AUTH0_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'AUTH0_SECRET not configured' },
        { status: 500 }
      );
    }

    // Create session data matching Auth0's session structure
    const sessionData = {
      user: E2E_TEST_USER,
      accessToken: 'mock-access-token-for-e2e-tests',
      accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      idToken: 'mock-id-token-for-e2e-tests',
    };

    // Encrypt the session using the same method as @auth0/nextjs-auth0
    // The SDK uses JWE with A256GCM encryption
    const secretKey = new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32));
    const jwe = await new jose.EncryptJWT(sessionData)
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .encrypt(secretKey);

    // Create redirect response with cookie
    const redirectUrl = new URL(shouldRedirect, request.url);
    const response = NextResponse.redirect(redirectUrl);

    // Set the session cookie on the redirect response
    response.cookies.set('appSession', jwe, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400, // 24 hours
    });

    console.log('Mock login: Session created, redirecting to', shouldRedirect);
    return response;
  } catch (error) {
    console.error('Mock login error:', error);
    return NextResponse.json(
      {
        error: 'Mock authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
