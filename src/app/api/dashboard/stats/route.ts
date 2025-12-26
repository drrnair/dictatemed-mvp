// src/app/api/dashboard/stats/route.ts
// Dashboard statistics API endpoint

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'dashboard-stats-api' });

export interface DashboardStats {
  draftCount: number;
  lettersToday: number;
  pendingReview: number;
  thisMonth: number;
  timeSavedHours: number;
  recentActivity: {
    id: string;
    patientInitials: string;
    letterType: string;
    status: 'pending' | 'approved';
    time: string;
  }[];
}

/**
 * GET /api/dashboard/stats
 * Returns dashboard statistics for the current user
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: userId, practiceId } = session.user;

    // Get date boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel for performance
    const [
      draftCount,
      lettersToday,
      pendingReview,
      thisMonth,
      approvedThisMonth,
      recentLetters,
    ] = await Promise.all([
      // Draft letters count (user's own drafts)
      prisma.letter.count({
        where: {
          userId,
          status: 'DRAFT',
        },
      }),

      // Letters created today (by user)
      prisma.letter.count({
        where: {
          userId,
          createdAt: {
            gte: todayStart,
          },
        },
      }),

      // Pending review (DRAFT + IN_REVIEW in the practice)
      prisma.letter.count({
        where: {
          user: { practiceId },
          status: {
            in: ['DRAFT', 'IN_REVIEW'],
          },
        },
      }),

      // Total letters this month (by user)
      prisma.letter.count({
        where: {
          userId,
          createdAt: {
            gte: monthStart,
          },
        },
      }),

      // Approved letters this month (for time saved calculation)
      prisma.letter.count({
        where: {
          userId,
          status: 'APPROVED',
          createdAt: {
            gte: monthStart,
          },
        },
      }),

      // Recent activity (last 5 letters)
      prisma.letter.findMany({
        where: {
          user: { practiceId },
        },
        select: {
          id: true,
          letterType: true,
          status: true,
          createdAt: true,
          patientId: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      }),
    ]);

    // Calculate time saved: assume ~15 min saved per approved letter
    const minutesSavedPerLetter = 15;
    const timeSavedHours = Math.round((approvedThisMonth * minutesSavedPerLetter) / 60);

    // Format recent activity
    const recentActivity = recentLetters.map((letter) => {
      // Patient data is encrypted - use patientId for initials or fallback
      const patientInitials = letter.patientId
        ? letter.patientId.substring(0, 2).toUpperCase()
        : '??';

      // Format letter type for display
      const letterType = letter.letterType
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());

      // Format relative time
      const diff = now.getTime() - new Date(letter.createdAt).getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      let time: string;
      if (days > 0) {
        time = `${days}d ago`;
      } else if (hours > 0) {
        time = `${hours}h ago`;
      } else if (minutes > 0) {
        time = `${minutes}m ago`;
      } else {
        time = 'Just now';
      }

      return {
        id: letter.id,
        patientInitials,
        letterType,
        status: letter.status === 'APPROVED' ? 'approved' : 'pending',
        time,
      };
    });

    const stats: DashboardStats = {
      draftCount,
      lettersToday,
      pendingReview,
      thisMonth,
      timeSavedHours,
      recentActivity: recentActivity as DashboardStats['recentActivity'],
    };

    return NextResponse.json(stats);
  } catch (error) {
    log.error('Error fetching dashboard stats', {
      action: 'getDashboardStats',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
