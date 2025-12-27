// src/app/api/health/route.ts
// Enhanced system health check endpoint for monitoring and load balancers
// Provides comprehensive service health status with latency metrics

import { NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { isRedisRateLimitingActive } from '@/lib/rate-limit';
import { getSupabaseServiceClient, STORAGE_BUCKETS } from '@/infrastructure/supabase/client';
import { logger } from '@/lib/logger';

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    database: ServiceStatus;
    redis: ServiceStatus;
    deepgram: ServiceStatus;
    anthropic: ServiceStatus;
    supabase: ServiceStatus;
  };
  summary: {
    totalChecks: number;
    passing: number;
    failing: number;
    degraded: number;
  };
}

// Cache health check results for 30 seconds to prevent overwhelming services
let cachedResponse: { data: HealthCheckResponse; timestamp: number } | null = null;
const CACHE_TTL_MS = 30_000;

// Track process start time for uptime calculation
const processStartTime = Date.now();

/**
 * Check database connectivity with a simple query
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    // Run a simple query to verify connectivity
    await prisma.$queryRaw`SELECT 1 as health_check`;

    // Also verify we can access a table (optional but more thorough)
    const userCount = await prisma.user.count();

    return {
      status: 'up',
      latencyMs: Date.now() - start,
      details: {
        connectionPool: 'active',
        userCount,
      },
    };
  } catch (error) {
    const latency = Date.now() - start;
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : String(error),
      latencyMs: latency,
    });

    return {
      status: 'down',
      latencyMs: latency,
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * Check Redis connectivity for rate limiting
 * Uses the isRedisRateLimitingActive() function which safely handles
 * production checks without throwing
 */
async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();

  // In test mode, skip Redis check
  if (process.env.MOCK_REDIS === 'true' || process.env.NODE_ENV === 'test') {
    return { status: 'up', message: 'mocked' };
  }

  try {
    const isActive = isRedisRateLimitingActive();
    const latency = Date.now() - start;

    if (isActive) {
      return {
        status: 'up',
        latencyMs: latency,
        details: {
          provider: 'upstash',
          ratelimiting: 'active',
        },
      };
    }

    // Redis not configured - this is degraded in production, acceptable in dev
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      status: isProduction ? 'degraded' : 'up',
      latencyMs: latency,
      message: isProduction
        ? 'Redis not configured - rate limiting using in-memory fallback'
        : 'Using in-memory rate limiting (acceptable for development)',
      details: {
        provider: 'memory',
        ratelimiting: 'fallback',
      },
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Redis check failed',
    };
  }
}

/**
 * Check Deepgram API availability
 * Full connectivity check would consume API credits, so we validate config
 */
async function checkDeepgram(): Promise<ServiceStatus> {
  // In test mode with mocking enabled, skip this check
  if (process.env.MOCK_DEEPGRAM_SERVICE === 'true') {
    return { status: 'up', message: 'mocked' };
  }

  if (!process.env.DEEPGRAM_API_KEY) {
    return {
      status: 'down',
      message: 'DEEPGRAM_API_KEY not configured',
    };
  }

  // Optionally perform a lightweight API check if needed
  // For now, config validation is sufficient
  return {
    status: 'up',
    details: {
      keyConfigured: true,
    },
  };
}

/**
 * Check Anthropic/Claude API availability
 * We only validate config since actual API calls cost money
 */
async function checkAnthropic(): Promise<ServiceStatus> {
  // In test mode with mocking enabled, skip this check
  if (process.env.MOCK_ANTHROPIC_SERVICE === 'true' || process.env.MOCK_BEDROCK_SERVICE === 'true') {
    return { status: 'up', message: 'mocked' };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const awsRegion = process.env.AWS_REGION;
  const bedrockEnabled = process.env.USE_BEDROCK === 'true';

  // Check for either direct Anthropic or Bedrock configuration
  if (bedrockEnabled) {
    if (!awsRegion) {
      return {
        status: 'down',
        message: 'AWS_REGION not configured for Bedrock',
      };
    }
    return {
      status: 'up',
      details: {
        provider: 'bedrock',
        region: awsRegion,
      },
    };
  }

  if (!anthropicKey) {
    return {
      status: 'down',
      message: 'ANTHROPIC_API_KEY not configured',
    };
  }

  return {
    status: 'up',
    details: {
      provider: 'anthropic-direct',
      keyConfigured: true,
    },
  };
}

/**
 * Check Supabase storage connectivity
 * Performs actual API call to verify bucket access
 */
async function checkSupabase(): Promise<ServiceStatus> {
  const start = Date.now();

  // In test mode with mocking enabled, skip this check
  if (process.env.MOCK_SUPABASE_STORAGE === 'true') {
    return { status: 'up', message: 'mocked' };
  }

  // First verify config
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      status: 'down',
      message: 'NEXT_PUBLIC_SUPABASE_URL not configured',
    };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      status: 'down',
      message: 'SUPABASE_SERVICE_ROLE_KEY not configured',
    };
  }

  try {
    const client = getSupabaseServiceClient();

    // Actually verify connectivity by listing buckets
    const { data: buckets, error } = await client.storage.listBuckets();

    if (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: `Supabase API error: ${error.message}`,
      };
    }

    const bucketNames = buckets?.map((b) => b.name) || [];
    const requiredBuckets = Object.values(STORAGE_BUCKETS);
    const missingBuckets = requiredBuckets.filter((b) => !bucketNames.includes(b));

    if (missingBuckets.length > 0) {
      return {
        status: 'degraded',
        latencyMs: Date.now() - start,
        message: `Missing buckets: ${missingBuckets.join(', ')}`,
        details: {
          availableBuckets: bucketNames,
          missingBuckets,
        },
      };
    }

    return {
      status: 'up',
      latencyMs: Date.now() - start,
      details: {
        buckets: bucketNames.length,
        allBucketsPresent: true,
      },
    };
  } catch (error) {
    const latency = Date.now() - start;
    logger.error('Supabase health check failed', {
      error: error instanceof Error ? error.message : String(error),
      latencyMs: latency,
    });

    return {
      status: 'down',
      latencyMs: latency,
      message: error instanceof Error ? error.message : 'Supabase connection failed',
    };
  }
}

/**
 * Perform all health checks in parallel
 */
async function performHealthCheck(): Promise<HealthCheckResponse> {
  const [database, redis, deepgram, anthropic, supabase] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkDeepgram(),
    checkAnthropic(),
    checkSupabase(),
  ]);

  const checks = { database, redis, deepgram, anthropic, supabase };

  // Calculate summary
  const allChecks = Object.values(checks);
  const passing = allChecks.filter((c) => c.status === 'up').length;
  const failing = allChecks.filter((c) => c.status === 'down').length;
  const degraded = allChecks.filter((c) => c.status === 'degraded').length;

  // Determine overall status
  // Database or Redis down = unhealthy (critical infrastructure)
  // Other services down = degraded (can function partially)
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (database.status === 'down') {
    status = 'unhealthy';
  } else if (redis.status === 'down' && process.env.NODE_ENV === 'production') {
    // Redis down in production is critical
    status = 'unhealthy';
  } else if (failing > 0 || degraded > 0) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
             process.env.npm_package_version ||
             '0.1.0',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    uptime: Math.floor((Date.now() - processStartTime) / 1000),
    checks,
    summary: {
      totalChecks: allChecks.length,
      passing,
      failing,
      degraded,
    },
  };
}

export async function GET() {
  // Check cache first
  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL_MS) {
    const cached = cachedResponse.data;
    return NextResponse.json(
      { ...cached, cached: true },
      {
        status: cached.status === 'unhealthy' ? 503 : 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Health-Cached': 'true',
          'X-Cache-Age': String(Math.floor((Date.now() - cachedResponse.timestamp) / 1000)),
        },
      }
    );
  }

  try {
    const health = await performHealthCheck();

    // Cache the result
    cachedResponse = {
      data: health,
      timestamp: Date.now(),
    };

    // Log health check results for monitoring
    if (health.status !== 'healthy') {
      logger.warn('Health check returned non-healthy status', {
        status: health.status,
        failing: health.summary.failing,
        degraded: health.summary.degraded,
      });
    }

    return NextResponse.json(health, {
      status: health.status === 'unhealthy' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Health-Cached': 'false',
      },
    });
  } catch (error) {
    // If health check itself fails, return unhealthy
    logger.error('Health check failed with exception', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: Math.floor((Date.now() - processStartTime) / 1000),
        error: error instanceof Error ? error.message : 'Health check failed',
        checks: {},
        summary: {
          totalChecks: 0,
          passing: 0,
          failing: 0,
          degraded: 0,
        },
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
