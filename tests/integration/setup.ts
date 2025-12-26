// tests/integration/setup.ts
// Integration test setup with mocked external services but real data patterns

import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock external services (AWS Bedrock, etc.) globally for integration tests
vi.mock('@/infrastructure/bedrock', () => ({
  generateTextWithRetry: vi.fn(),
  MODELS: {
    SONNET: 'claude-sonnet',
    OPUS: 'claude-opus',
    HAIKU: 'claude-haiku',
  },
}));

// Create a chainable mock logger that supports nested child() calls
// Use plain functions instead of vi.fn() to survive vi.clearAllMocks()
const mockLogFn = vi.hoisted(() => {
  const fn = Object.assign(() => {}, {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => fn,
  });
  return fn;
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mockLogFn.info,
    warn: mockLogFn.warn,
    error: mockLogFn.error,
    debug: mockLogFn.debug,
    child: () => mockLogFn,
  },
}));

beforeAll(async () => {
  // Integration tests use mocked Prisma (no actual database)
  // This allows tests to run without database setup
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  // Cleanup
});
