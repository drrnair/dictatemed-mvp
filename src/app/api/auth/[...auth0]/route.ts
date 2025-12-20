// src/app/api/auth/[...auth0]/route.ts
// Auth0 authentication handler

import {
  handleAuth,
  handleLogin,
  handleCallback,
  type Session,
} from '@auth0/nextjs-auth0';
import type { NextRequest } from 'next/server';

export const GET = handleAuth({
  login: handleLogin({
    authorizationParams: {
      // Force MFA on every login per security requirements
      acr_values:
        'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
    },
  }),
  callback: handleCallback({
    afterCallback: async (
      _req: NextRequest,
      session: Session
    ): Promise<Session> => {
      // Could add custom logic here after successful auth
      // e.g., create user in database if not exists
      return session;
    },
  }),
});
