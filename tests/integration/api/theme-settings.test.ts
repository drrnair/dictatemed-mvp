// tests/integration/api/theme-settings.test.ts
// Integration tests for theme settings API endpoints

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/user/settings/theme/route';
import * as auth from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const mockUser = {
  id: 'user-123',
  auth0Id: 'auth0|123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'SPECIALIST' as const,
  practiceId: 'practice-123',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  signature: null,
  styleProfile: null,
  lastLoginAt: null,
  settings: {},
};

function createRequest(url: string, options: { method?: string; body?: string } = {}) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('Theme Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUser });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/user/settings/theme', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const response = await GET();

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 404 when user does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await GET();

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('User not found');
    });

    it('should return system as default when no settings exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.themePreference).toBe('system');
    });

    it('should return system as default when settings is null', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: null,
      });

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.themePreference).toBe('system');
    });

    it('should return stored light theme preference', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: { themePreference: 'light' },
      });

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.themePreference).toBe('light');
    });

    it('should return stored dark theme preference', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: { themePreference: 'dark' },
      });

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.themePreference).toBe('dark');
    });

    it('should return system theme preference', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: { themePreference: 'system' },
      });

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.themePreference).toBe('system');
    });

    it('should return system as fallback for invalid stored value', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: { themePreference: 'invalid-theme' },
      });

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.themePreference).toBe('system');
    });
  });

  describe('PUT /api/user/settings/theme', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/user/settings/theme', {
        method: 'PUT',
        body: JSON.stringify({ themePreference: 'dark' }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 404 when user does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/user/settings/theme', {
        method: 'PUT',
        body: JSON.stringify({ themePreference: 'dark' }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('User not found');
    });

    it('should return 400 for invalid theme value', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });

      const request = createRequest('/api/user/settings/theme', {
        method: 'PUT',
        body: JSON.stringify({ themePreference: 'invalid' }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should return 400 when themePreference is missing', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });

      const request = createRequest('/api/user/settings/theme', {
        method: 'PUT',
        body: JSON.stringify({}),
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should return 400 for non-string theme value', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });

      const request = createRequest('/api/user/settings/theme', {
        method: 'PUT',
        body: JSON.stringify({ themePreference: 123 }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should update to dark theme successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        settings: { themePreference: 'dark' },
      });

      const request = createRequest('/api/user/settings/theme', {
        method: 'PUT',
        body: JSON.stringify({ themePreference: 'dark' }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.themePreference).toBe('dark');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: {
            settings: expect.objectContaining({
              themePreference: 'dark',
            }),
          },
        })
      );
    });

    it('should update to light theme successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: { themePreference: 'dark' },
      });
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        settings: { themePreference: 'light' },
      });

      const request = createRequest('/api/user/settings/theme', {
        method: 'PUT',
        body: JSON.stringify({ themePreference: 'light' }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.themePreference).toBe('light');
    });

    it('should update to system theme successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: { themePreference: 'dark' },
      });
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        settings: { themePreference: 'system' },
      });

      const request = createRequest('/api/user/settings/theme', {
        method: 'PUT',
        body: JSON.stringify({ themePreference: 'system' }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.themePreference).toBe('system');
    });

    it('should preserve other settings when updating theme', async () => {
      const existingSettings = {
        themePreference: 'light',
        letterSending: {
          alwaysCcGp: true,
          defaultSubjectTemplate: 'Custom subject',
        },
        otherSettings: { someValue: true },
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: existingSettings,
      });
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        settings: {
          ...existingSettings,
          themePreference: 'dark',
        },
      });

      const request = createRequest('/api/user/settings/theme', {
        method: 'PUT',
        body: JSON.stringify({ themePreference: 'dark' }),
      });
      await PUT(request);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: {
            settings: expect.objectContaining({
              letterSending: existingSettings.letterSending,
              otherSettings: existingSettings.otherSettings,
              themePreference: 'dark',
            }),
          },
        })
      );
    });
  });
});
