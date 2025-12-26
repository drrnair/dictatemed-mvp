// src/app/api/health/route.ts
// System health check endpoint for monitoring and load balancers

import { NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: ServiceStatus;
    deepgram: ServiceStatus;
    bedrock: ServiceStatus;
    supabase: ServiceStatus;
  };
}

// Cache health check results for 30 seconds
let cachedResponse: { data: HealthCheckResponse; timestamp: number } | null =
  null;
const CACHE_TTL_MS = 30_000;

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'up',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkDeepgram(): Promise<ServiceStatus> {
  // Deepgram health check - just verify API key is configured
  // Full connectivity check would be expensive
  // In test mode with mocking enabled, skip this check
  if (process.env.MOCK_DEEPGRAM_SERVICE === 'true') {
    return { status: 'up', message: 'mocked' };
  }
  if (!process.env.DEEPGRAM_API_KEY) {
    return {
      status: 'down',
      message: 'API key not configured',
    };
  }
  return { status: 'up' };
}

async function checkBedrock(): Promise<ServiceStatus> {
  // Bedrock health check - verify credentials are configured
  // Full connectivity check would be expensive
  // In test mode with mocking enabled, skip this check
  if (process.env.MOCK_BEDROCK_SERVICE === 'true') {
    return { status: 'up', message: 'mocked' };
  }
  if (!process.env.AWS_REGION) {
    return {
      status: 'down',
      message: 'AWS region not configured',
    };
  }
  return { status: 'up' };
}

async function checkSupabase(): Promise<ServiceStatus> {
  // Supabase health check - verify credentials are configured
  // In test mode with mocking enabled, skip this check
  if (process.env.MOCK_SUPABASE_STORAGE === 'true') {
    return { status: 'up', message: 'mocked' };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      status: 'down',
      message: 'Supabase URL not configured',
    };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      status: 'down',
      message: 'Supabase service role key not configured',
    };
  }
  return { status: 'up' };
}

async function performHealthCheck(): Promise<HealthCheckResponse> {
  const [database, deepgram, bedrock, supabase] = await Promise.all([
    checkDatabase(),
    checkDeepgram(),
    checkBedrock(),
    checkSupabase(),
  ]);

  const checks = { database, deepgram, bedrock, supabase };

  // Determine overall status
  const allChecks = Object.values(checks);
  const hasDown = allChecks.some((c) => c.status === 'down');
  const hasDegraded = allChecks.some((c) => c.status === 'degraded');

  // Database down = unhealthy (critical)
  // Other services down = degraded (can still function partially)
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (database.status === 'down') {
    status = 'unhealthy';
  } else if (hasDown || hasDegraded) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    checks,
  };
}

export async function GET() {
  // Check cache
  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedResponse.data, {
      status: cachedResponse.data.status === 'unhealthy' ? 503 : 200,
    });
  }

  const health = await performHealthCheck();

  // Cache the result
  cachedResponse = {
    data: health,
    timestamp: Date.now(),
  };

  return NextResponse.json(health, {
    status: health.status === 'unhealthy' ? 503 : 200,
  });
}
