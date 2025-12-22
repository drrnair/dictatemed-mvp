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

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
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
