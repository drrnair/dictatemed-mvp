// tests/e2e/setup/auth.setup.ts
// Setup script to generate auth state for E2E tests
//
// Run with:
//   E2E_TEST_USER_EMAIL=test@example.com E2E_TEST_USER_PASSWORD=password \
//   npx playwright test tests/e2e/setup/auth.setup.ts --project=chromium

import { test } from '@playwright/test';
import { authenticateAndSaveState, AUTH_STATE_PATH } from '../fixtures/auth';

test.describe.configure({ mode: 'serial' });

test('authenticate and save state', async ({ page }) => {
  console.log('Setting up authentication...');
  console.log(`Auth state will be saved to: ${AUTH_STATE_PATH}`);

  await authenticateAndSaveState(page);

  console.log('Authentication state saved successfully!');
  console.log('You can now run authenticated tests with:');
  console.log('  npx playwright test tests/e2e/flows/style-profiles.spec.ts');
});
