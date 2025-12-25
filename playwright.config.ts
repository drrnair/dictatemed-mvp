import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Playwright E2E Test Configuration for DictateMED
 *
 * Features:
 * - Auth setup project for reusable authentication state
 * - Multi-browser testing (Chrome, Firefox, Safari)
 * - Video/screenshot capture on failures
 * - GitHub reporter for CI integration
 * - Appropriate timeouts for clinical workflows
 *
 * Run locally:
 *   npx playwright test
 *
 * Run specific browser:
 *   npx playwright test --project=chromium
 *   npx playwright test --project=firefox
 *   npx playwright test --project=webkit
 *
 * Run with UI:
 *   npx playwright test --ui
 */

// Auth state storage path
const AUTH_STATE_PATH = path.join(__dirname, 'tests/e2e/.auth/user.json');

export default defineConfig({
  testDir: './tests/e2e',

  // Run workflow tests serially, others in parallel
  fullyParallel: true,

  // Fail the build on CI if test.only is left in code
  forbidOnly: !!process.env.CI,

  // Retry failed tests (more retries in CI for flakiness)
  retries: process.env.CI ? 2 : 1,

  // Parallel workers (single worker in CI for stability)
  workers: process.env.CI ? 1 : 4,

  // Reporter configuration
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
      ]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'on-failure' }],
      ],

  // Global timeout for each test
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Global setup for environment validation
  globalSetup: './tests/e2e/global-setup.ts',

  // Shared settings for all projects
  use: {
    // Base URL for the application
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',

    // Collect trace on first retry for debugging
    trace: 'on-first-retry',

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure (first retry)
    video: process.env.CI ? 'on-first-retry' : 'off',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Slow down actions slightly for stability
    actionTimeout: 15000,

    // Navigation timeout
    navigationTimeout: 30000,

    // Ignore HTTPS errors (for local development)
    ignoreHTTPSErrors: true,
  },

  // Configure projects for multi-browser testing
  projects: [
    // Setup project - runs first to generate auth state
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'teardown',
    },

    // Teardown project - runs after all tests
    {
      name: 'teardown',
      testMatch: /.*\.teardown\.ts/,
    },

    // Chromium (Chrome/Edge) - Primary browser
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_PATH,
      },
      dependencies: ['setup'],
    },

    // Firefox - Secondary browser
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: AUTH_STATE_PATH,
        // Firefox-specific timing adjustments
        actionTimeout: 20000,
      },
      dependencies: ['setup'],
    },

    // WebKit (Safari) - Cross-platform testing
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: AUTH_STATE_PATH,
        // WebKit-specific adjustments
        actionTimeout: 20000,
      },
      dependencies: ['setup'],
    },

    // Tablet testing for responsive design
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro 11'],
        storageState: AUTH_STATE_PATH,
      },
      dependencies: ['setup'],
    },

    // Mobile testing (optional)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: AUTH_STATE_PATH,
      },
      dependencies: ['setup'],
    },

    // Mobile Safari (optional)
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        storageState: AUTH_STATE_PATH,
      },
      dependencies: ['setup'],
    },
  ],

  // Web server configuration
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // Use test database in CI
      DATABASE_URL: process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || '',
      // Mock external services
      MOCK_BEDROCK_SERVICE: 'true',
      MOCK_SUPABASE_STORAGE: 'true',
    },
  },

  // Output directory for test artifacts
  outputDir: 'test-results/',

  // Preserve output on failure
  preserveOutput: 'failures-only',

  // Maximum time for the entire test suite
  globalTimeout: process.env.CI ? 600000 : undefined, // 10 minutes in CI
});
