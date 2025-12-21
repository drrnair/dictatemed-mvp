import { test, expect } from '@playwright/test';

test.describe('API Health Checks', () => {
  test('API routes should return proper status codes for unauthenticated requests', async ({
    request,
  }) => {
    // Protected routes should return 401 Unauthorized
    const protectedRoutes = [
      '/api/consultations',
      '/api/recordings',
      '/api/documents',
      '/api/letters',
      '/api/patients',
    ];

    for (const route of protectedRoutes) {
      const response = await request.get(route);
      expect(response.status()).toBe(401);
    }
  });

  test('Transcription webhook should exist', async ({ request }) => {
    // POST to webhook without proper signature should fail
    const response = await request.post('/api/transcription/webhook', {
      data: { test: true },
    });

    // Should return 400 or 401 (not 404)
    expect([400, 401]).toContain(response.status());
  });
});
