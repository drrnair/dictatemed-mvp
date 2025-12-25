// tests/e2e/global-setup.ts
// Global setup for E2E tests
//
// This script runs once before all tests to:
// 1. Validate environment configuration
// 2. Check database connectivity
// 3. Verify test data exists
// 4. Ensure auth state directory exists

import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Required environment variables for E2E tests
 */
const REQUIRED_ENV_VARS = [
  'E2E_TEST_USER_EMAIL',
  'E2E_TEST_USER_PASSWORD',
];

/**
 * Optional but recommended environment variables
 */
const OPTIONAL_ENV_VARS = [
  'E2E_BASE_URL',
  'E2E_DATABASE_URL',
  'E2E_MOCK_AUTH_TOKEN',
];

/**
 * Validate that all required environment variables are set
 */
function validateEnvironment(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check optional variables
  for (const envVar of OPTIONAL_ENV_VARS) {
    if (!process.env[envVar]) {
      warnings.push(envVar);
    }
  }

  // Report warnings
  if (warnings.length > 0) {
    console.log('\n⚠️  Optional environment variables not set:');
    warnings.forEach(v => console.log(`   - ${v}`));
    console.log('   Tests will use defaults.\n');
  }

  // Fail on missing required variables
  if (missing.length > 0) {
    console.error('\n❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nCreate .env.test file or set these variables:');
    console.error('  export E2E_TEST_USER_EMAIL=test.cardiologist+e2e@dictatemed.dev');
    console.error('  export E2E_TEST_USER_PASSWORD=your-test-password\n');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('✅ Environment validation passed');
}

/**
 * Check database connectivity
 * Uses a simple fetch to the health endpoint instead of direct DB connection
 */
async function checkDatabaseHealth(): Promise<void> {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const healthUrl = `${baseUrl}/api/health`;

  try {
    // Skip health check if server isn't running yet (webServer will start it)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(healthUrl, {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (response === null) {
      console.log('⏳ Server not running yet - will be started by Playwright');
      return;
    }

    if (!response.ok) {
      console.warn(`⚠️  Health check returned ${response.status}`);
      return;
    }

    const health = await response.json();
    if (health.database === 'connected' || health.status === 'ok') {
      console.log('✅ Database health check passed');
    } else {
      console.warn('⚠️  Database may not be fully connected');
    }
  } catch (error) {
    // Don't fail - the webServer config will start the server
    console.log('⏳ Server not available - will be started by Playwright webServer');
  }
}

/**
 * Ensure auth state directory exists
 */
function ensureAuthDirectory(): void {
  const authDir = path.join(__dirname, '.auth');

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log('✅ Created auth state directory');
  } else {
    console.log('✅ Auth state directory exists');
  }

  // Check if auth state file exists
  const authStatePath = path.join(authDir, 'user.json');
  if (fs.existsSync(authStatePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(authStatePath, 'utf-8'));
      const hasCookies = state.cookies && state.cookies.length > 0;
      if (hasCookies) {
        console.log('✅ Auth state file found with valid session');
      } else {
        console.log('⚠️  Auth state file exists but has no cookies - will re-authenticate');
      }
    } catch {
      console.log('⚠️  Auth state file is invalid - will re-authenticate');
    }
  } else {
    console.log('ℹ️  No auth state file - setup project will authenticate');
  }
}

/**
 * Verify test data prefix compliance
 */
function verifyTestDataCompliance(): void {
  // Check that test user email follows convention
  const testEmail = process.env.E2E_TEST_USER_EMAIL || '';
  if (testEmail && !testEmail.includes('test') && !testEmail.includes('e2e')) {
    console.warn('⚠️  E2E_TEST_USER_EMAIL should contain "test" or "e2e" for safety');
  }

  console.log('✅ Test data compliance check passed');
}

/**
 * Log test configuration summary
 */
function logConfiguration(config: FullConfig): void {
  console.log('\n📋 E2E Test Configuration:');
  console.log(`   Base URL: ${process.env.E2E_BASE_URL || 'http://localhost:3000'}`);
  console.log(`   Test User: ${process.env.E2E_TEST_USER_EMAIL}`);
  console.log(`   Projects: ${config.projects.map(p => p.name).join(', ')}`);
  console.log(`   Workers: ${config.workers}`);
  console.log(`   Retries: ${config.projects[0]?.retries ?? 0}`);
  console.log(`   CI Mode: ${process.env.CI ? 'Yes' : 'No'}`);
  console.log('');
}

/**
 * Global setup function
 * Runs once before all tests
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n🚀 Starting E2E Test Global Setup\n');
  console.log('='.repeat(50));

  try {
    // 1. Validate environment
    validateEnvironment();

    // 2. Ensure auth directory exists
    ensureAuthDirectory();

    // 3. Check database health (non-blocking)
    await checkDatabaseHealth();

    // 4. Verify test data compliance
    verifyTestDataCompliance();

    // 5. Log configuration summary
    logConfiguration(config);

    console.log('='.repeat(50));
    console.log('✅ Global setup completed successfully\n');
  } catch (error) {
    console.error('='.repeat(50));
    console.error('❌ Global setup failed\n');
    throw error;
  }
}

export default globalSetup;
