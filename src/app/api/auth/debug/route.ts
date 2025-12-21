// Debug endpoint to check Auth0 configuration
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    env: {
      AUTH0_SECRET: process.env.AUTH0_SECRET ? 'SET' : 'MISSING',
      AUTH0_BASE_URL: process.env.AUTH0_BASE_URL || 'MISSING',
      AUTH0_ISSUER_BASE_URL: process.env.AUTH0_ISSUER_BASE_URL || 'MISSING',
      AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID ? 'SET' : 'MISSING',
      AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET ? 'SET' : 'MISSING',
    },
    timestamp: new Date().toISOString(),
  });
}
