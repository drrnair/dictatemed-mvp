// src/app/api/auth/[...auth0]/route.ts
// Auth0 authentication handler

import { handleAuth } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

// Use default Auth0 handlers with error handling
export const GET = async (req: Request, ctx: { params: { auth0: string[] } }) => {
  try {
    const handler = handleAuth();
    return handler(req, ctx);
  } catch (error) {
    console.error('Auth0 error:', error);
    return NextResponse.json(
      {
        error: 'Authentication error',
        message: error instanceof Error ? error.message : 'Unknown error',
        env: {
          hasSecret: !!process.env.AUTH0_SECRET,
          hasBaseUrl: !!process.env.AUTH0_BASE_URL,
          hasIssuer: !!process.env.AUTH0_ISSUER_BASE_URL,
          hasClientId: !!process.env.AUTH0_CLIENT_ID,
          hasClientSecret: !!process.env.AUTH0_CLIENT_SECRET,
        }
      },
      { status: 500 }
    );
  }
};
