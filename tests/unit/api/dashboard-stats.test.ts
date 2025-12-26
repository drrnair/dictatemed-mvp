import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, type DashboardStats } from '@/app/api/dashboard/stats/route';
import { NextResponse } from 'next/server';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock the prisma client
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    letter: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { getSession } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';

describe('Dashboard Stats API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/dashboard/stats', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return dashboard stats when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        practiceId: 'practice-456',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN' as const,
        auth0Id: 'auth0|123',
        subspecialties: [],
        onboardingCompleted: true,
      };

      vi.mocked(getSession).mockResolvedValue({ user: mockUser });

      // Mock the parallel queries
      vi.mocked(prisma.letter.count)
        .mockResolvedValueOnce(5)  // draftCount
        .mockResolvedValueOnce(2)  // lettersToday
        .mockResolvedValueOnce(8)  // pendingReview
        .mockResolvedValueOnce(15) // thisMonth
        .mockResolvedValueOnce(10); // approvedThisMonth

      // Only include fields that the API actually selects
      vi.mocked(prisma.letter.findMany).mockResolvedValue([
        {
          id: 'letter-1',
          letterType: 'NEW_PATIENT',
          status: 'DRAFT',
          createdAt: new Date(),
          patientId: 'patient-abc',
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.letter.findMany>>);

      const response = await GET();
      const data: DashboardStats = await response.json();

      expect(response.status).toBe(200);
      expect(data.draftCount).toBe(5);
      expect(data.lettersToday).toBe(2);
      expect(data.pendingReview).toBe(8);
      expect(data.thisMonth).toBe(15);
      expect(data.timeSavedHours).toBe(3); // 10 * 15 / 60 = 2.5, Math.round gives 3
      expect(data.recentActivity).toBeDefined();
      expect(Array.isArray(data.recentActivity)).toBe(true);
    });

    it('should format recent activity correctly', async () => {
      const mockUser = {
        id: 'user-123',
        practiceId: 'practice-456',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN' as const,
        auth0Id: 'auth0|123',
        subspecialties: [],
        onboardingCompleted: true,
      };

      vi.mocked(getSession).mockResolvedValue({ user: mockUser });

      vi.mocked(prisma.letter.count).mockResolvedValue(0);
      // Only include fields that the API actually selects
      vi.mocked(prisma.letter.findMany).mockResolvedValue([
        {
          id: 'letter-1',
          letterType: 'FOLLOW_UP',
          status: 'APPROVED',
          createdAt: new Date(Date.now() - 60000), // 1 minute ago
          patientId: 'ab123456',
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.letter.findMany>>);

      const response = await GET();
      const data: DashboardStats = await response.json();

      expect(data.recentActivity.length).toBeGreaterThan(0);
      const firstActivity = data.recentActivity[0];
      expect(firstActivity?.patientInitials).toBe('AB');
      expect(firstActivity?.letterType).toBe('Follow Up');
      expect(firstActivity?.status).toBe('approved');
      expect(firstActivity?.time).toMatch(/\d+m ago|Just now/);
    });
  });
});
