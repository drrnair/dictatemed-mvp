// tests/integration/api/letter-settings.test.ts
// Integration tests for letter sending settings API endpoints

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/user/settings/letters/route';
import * as auth from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { DEFAULT_SENDING_PREFERENCES } from '@/domains/letters/sending.types';

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
  clinicianRole: 'MEDICAL' as const,
  practiceId: 'practice-123',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
  // Additional required Prisma fields
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

describe('Letter Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUser });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/user/settings/letters', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/user/settings/letters');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 404 when user does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/user/settings/letters');
      const response = await GET(request);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('User not found');
    });

    it('should return default preferences when no settings exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });

      const request = createRequest('/api/user/settings/letters');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.preferences).toEqual(DEFAULT_SENDING_PREFERENCES);
    });

    it('should return default preferences when settings is null', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: null,
      });

      const request = createRequest('/api/user/settings/letters');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.preferences).toEqual(DEFAULT_SENDING_PREFERENCES);
    });

    it('should return stored preferences merged with defaults', async () => {
      const customSettings = {
        letterSending: {
          alwaysCcGp: false,
          defaultSubjectTemplate: 'Custom subject',
        },
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: customSettings,
      });

      const request = createRequest('/api/user/settings/letters');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.preferences).toEqual({
        alwaysCcGp: false,
        alwaysCcSelf: DEFAULT_SENDING_PREFERENCES.alwaysCcSelf,
        includeReferrer: DEFAULT_SENDING_PREFERENCES.includeReferrer,
        defaultSubjectTemplate: 'Custom subject',
        defaultCoverNote: DEFAULT_SENDING_PREFERENCES.defaultCoverNote,
      });
    });

    it('should return fully customized preferences', async () => {
      const fullSettings = {
        letterSending: {
          alwaysCcGp: false,
          alwaysCcSelf: false,
          includeReferrer: false,
          defaultSubjectTemplate: 'Re: {{patient_name}}',
          defaultCoverNote: 'Please find attached the consultation letter.',
        },
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: fullSettings,
      });

      const request = createRequest('/api/user/settings/letters');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.preferences).toEqual(fullSettings.letterSending);
    });
  });

  describe('PUT /api/user/settings/letters', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/user/settings/letters', {
        method: 'PUT',
        body: JSON.stringify({ alwaysCcGp: false }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 404 when user does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/user/settings/letters', {
        method: 'PUT',
        body: JSON.stringify({ alwaysCcGp: false }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('User not found');
    });

    it('should return 400 for invalid subject template', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });

      const request = createRequest('/api/user/settings/letters', {
        method: 'PUT',
        body: JSON.stringify({ defaultSubjectTemplate: 'x'.repeat(501) }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should return 400 for invalid cover note', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });

      const request = createRequest('/api/user/settings/letters', {
        method: 'PUT',
        body: JSON.stringify({ defaultCoverNote: 'x'.repeat(2001) }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should return 400 for invalid boolean type', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });

      const request = createRequest('/api/user/settings/letters', {
        method: 'PUT',
        body: JSON.stringify({ alwaysCcGp: 'not-a-boolean' }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should update single preference successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        settings: { letterSending: { alwaysCcGp: false } },
      });

      const request = createRequest('/api/user/settings/letters', {
        method: 'PUT',
        body: JSON.stringify({ alwaysCcGp: false }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.preferences.alwaysCcGp).toBe(false);
      expect(json.preferences.alwaysCcSelf).toBe(DEFAULT_SENDING_PREFERENCES.alwaysCcSelf);
    });

    it('should update multiple preferences successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        settings: {
          letterSending: {
            alwaysCcGp: false,
            alwaysCcSelf: false,
            defaultSubjectTemplate: 'Custom subject',
          },
        },
      });

      const request = createRequest('/api/user/settings/letters', {
        method: 'PUT',
        body: JSON.stringify({
          alwaysCcGp: false,
          alwaysCcSelf: false,
          defaultSubjectTemplate: 'Custom subject',
        }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.preferences.alwaysCcGp).toBe(false);
      expect(json.preferences.alwaysCcSelf).toBe(false);
      expect(json.preferences.defaultSubjectTemplate).toBe('Custom subject');
    });

    it('should merge with existing settings', async () => {
      const existingSettings = {
        letterSending: {
          alwaysCcGp: false,
          defaultSubjectTemplate: 'Old subject',
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
          letterSending: {
            alwaysCcGp: false,
            defaultSubjectTemplate: 'New subject',
          },
          otherSettings: { someValue: true },
        },
      });

      const request = createRequest('/api/user/settings/letters', {
        method: 'PUT',
        body: JSON.stringify({ defaultSubjectTemplate: 'New subject' }),
      });
      await PUT(request);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: {
            settings: expect.objectContaining({
              otherSettings: { someValue: true },
              letterSending: expect.objectContaining({
                alwaysCcGp: false,
                defaultSubjectTemplate: 'New subject',
              }),
            }),
          },
        })
      );
    });

    it('should handle empty update body', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        settings: { letterSending: {} },
      });

      const request = createRequest('/api/user/settings/letters', {
        method: 'PUT',
        body: JSON.stringify({}),
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.preferences).toEqual(DEFAULT_SENDING_PREFERENCES);
    });

    it('should update cover note preference', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {},
      });
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        settings: {
          letterSending: {
            defaultCoverNote: 'Please review the attached letter.',
          },
        },
      });

      const request = createRequest('/api/user/settings/letters', {
        method: 'PUT',
        body: JSON.stringify({
          defaultCoverNote: 'Please review the attached letter.',
        }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.preferences.defaultCoverNote).toBe('Please review the attached letter.');
    });

    it('should allow clearing cover note', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        settings: {
          letterSending: {
            defaultCoverNote: 'Existing note',
          },
        },
      });
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        settings: {
          letterSending: {
            defaultCoverNote: '',
          },
        },
      });

      const request = createRequest('/api/user/settings/letters', {
        method: 'PUT',
        body: JSON.stringify({ defaultCoverNote: '' }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.preferences.defaultCoverNote).toBe('');
    });
  });
});
