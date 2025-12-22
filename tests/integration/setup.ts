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
// The mock is created inside the factory to ensure fresh mocks are created
// after vi.clearAllMocks() is called
vi.mock('@/lib/logger', () => {
  const createMockLogger = (): Record<string, unknown> => {
    const mockLogger: Record<string, unknown> = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    // child() returns a new mock logger instance that also supports chaining
    mockLogger.child = vi.fn(() => createMockLogger());
    return mockLogger;
  };
  return { logger: createMockLogger() };
});

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
