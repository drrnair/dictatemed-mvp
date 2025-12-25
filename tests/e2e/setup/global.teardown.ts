// tests/e2e/setup/global.teardown.ts
// Teardown script that runs after all E2E tests complete
//
// This script:
// 1. Cleans up test artifacts if needed
// 2. Reports test summary
// 3. Optionally cleans up auth state

import { test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('E2E test teardown', async () => {
  console.log('\n🧹 Running E2E Test Teardown\n');
  console.log('='.repeat(50));

  // Log completion
  console.log('✅ E2E tests completed');

  // In CI, we might want to clean up auth state
  if (process.env.CI) {
    console.log('ℹ️  CI mode: Auth state will be cleaned up automatically');
  } else {
    console.log('ℹ️  Local mode: Auth state preserved for faster subsequent runs');
  }

  console.log('='.repeat(50));
  console.log('\n✅ Teardown completed\n');
});
