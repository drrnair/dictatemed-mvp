// src/app/api/notifications/route.ts
// Notification management API

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import {
  getRecent,
  markRead,
  markAllRead,
  markManyRead,
  getUnreadCount,
} from '@/domains/notifications/notification.service';
import { logger } from '@/lib/logger';

const markReadSchema = z.object({
  action: z.literal('markRead'),
  notificationId: z.string().uuid(),
});

const markManyReadSchema = z.object({
  action: z.literal('markManyRead'),
  notificationIds: z.array(z.string().uuid()),
});

const markAllReadSchema = z.object({
  action: z.literal('markAllRead'),
});

const actionSchema = z.discriminatedUnion('action', [
  markReadSchema,
  markManyReadSchema,
  markAllReadSchema,
]);

/**
 * GET /api/notifications - Get notifications for current user
 * Query params: limit (default: 10)
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'getNotifications' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;

    const [notifications, unreadCount] = await Promise.all([
      getRecent(userId, limit),
      getUnreadCount(userId),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    log.error(
      'Failed to get notifications',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to get notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications - Mark notification(s) as read
 * Body: { action: 'markRead', notificationId: string } |
 *       { action: 'markManyRead', notificationIds: string[] } |
 *       { action: 'markAllRead' }
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'updateNotifications' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const validated = actionSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    const { action } = validated.data;

    switch (action) {
      case 'markRead': {
        const { notificationId } = validated.data;
        await markRead(notificationId, userId);

        log.info('Notification marked as read', { notificationId });

        return NextResponse.json({
          success: true,
          notificationId,
        });
      }

      case 'markManyRead': {
        const { notificationIds } = validated.data;
        const count = await markManyRead(notificationIds, userId);

        log.info('Multiple notifications marked as read', {
          count,
          notificationIds,
        });

        return NextResponse.json({
          success: true,
          count,
        });
      }

      case 'markAllRead': {
        const count = await markAllRead(userId);

        log.info('All notifications marked as read', { count });

        return NextResponse.json({
          success: true,
          count,
        });
      }

      default: {
        // This should never happen due to discriminated union
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    log.error(
      'Failed to update notifications',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}
