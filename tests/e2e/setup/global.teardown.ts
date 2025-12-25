// tests/e2e/setup/global.teardown.ts
// Teardown script that runs after all E2E tests complete
//
// This script:
// 1. Cleans up auth state in CI
// 2. Reports test summary
// 3. Cleans up test data via API (if configured)
//
// Note: Database cleanup is handled by the GitHub Actions workflow
// via `npm run db:teardown:e2e` for more reliable transactional cleanup.
// This script handles browser-side cleanup only.

import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Path to auth state file
const AUTH_STATE_PATH = path.join(__dirname, '../.auth/user.json');

test.describe.configure({ mode: 'serial' });

test('E2E test teardown', async ({ request }) => {
  console.log('\n🧹 Running E2E Test Teardown\n');
  console.log('='.repeat(50));

  // Skip teardown if explicitly disabled
  if (process.env.E2E_SKIP_TEARDOWN === 'true') {
    console.log('⏭️  Teardown skipped (E2E_SKIP_TEARDOWN=true)');
    console.log('='.repeat(50));
    return;
  }

  let cleanupCount = 0;

  // 1. Clean up auth state in CI
  if (process.env.CI) {
    try {
      if (fs.existsSync(AUTH_STATE_PATH)) {
        fs.unlinkSync(AUTH_STATE_PATH);
        console.log('✅ Auth state file cleaned up');
        cleanupCount++;
      } else {
        console.log('ℹ️  No auth state file to clean up');
      }
    } catch (error) {
      console.warn('⚠️  Failed to clean up auth state:', error);
    }
  } else {
    console.log('ℹ️  Local mode: Auth state preserved for faster subsequent runs');
  }

  // 2. Call cleanup API endpoint if available (non-blocking)
  // This allows the app to clean up any in-memory test state
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
  try {
    const response = await request.post(`${baseUrl}/api/test/cleanup`, {
      headers: {
        'X-Test-Cleanup': 'true',
      },
      timeout: 5000,
    });

    if (response.ok()) {
      console.log('✅ Test cleanup API called successfully');
      cleanupCount++;
    } else if (response.status() === 404) {
      // Endpoint doesn't exist - this is fine, not all apps have it
      console.log('ℹ️  Test cleanup API not available (404)');
    } else {
      console.warn(`⚠️  Test cleanup API returned ${response.status()}`);
    }
  } catch {
    // Network error or timeout - not critical
    console.log('ℹ️  Test cleanup API not reachable (server may be stopped)');
  }

  // 3. Report summary
  console.log('');
  console.log('='.repeat(50));
  console.log(`✅ Teardown completed (${cleanupCount} cleanup actions)`);
  console.log('');
  console.log('Note: Database cleanup is handled by the CI workflow');
  console.log('      via `npm run db:teardown:e2e` for transactional safety.');
  console.log('='.repeat(50));
  console.log('');
});
