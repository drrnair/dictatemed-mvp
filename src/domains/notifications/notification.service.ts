// src/domains/notifications/notification.service.ts
// Service layer for notification management

import { prisma } from '@/infrastructure/db/client';
import type {
  Notification,
  CreateNotificationInput,
  NotificationFilters,
  NotificationType,
} from './notification.types';

/**
 * Create a new notification for a user
 */
export async function create(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<Notification> {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data as object | undefined,
    },
  });

  return {
    ...notification,
    data: (notification.data as Record<string, unknown>) || null,
  };
}

/**
 * Get unread notifications for a user
 */
export async function getUnread(userId: string): Promise<Notification[]> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      read: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return notifications.map((n) => ({
    ...n,
    data: (n.data as Record<string, unknown>) || null,
  }));
}

/**
 * Get recent notifications for a user
 */
export async function getRecent(
  userId: string,
  limit: number = 10
): Promise<Notification[]> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  return notifications.map((n) => ({
    ...n,
    data: (n.data as Record<string, unknown>) || null,
  }));
}

/**
 * Get all notifications for a user with optional filters
 */
export async function getAll(filters: NotificationFilters): Promise<Notification[]> {
  const { userId, read, type, limit = 50, offset = 0 } = filters;

  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      ...(read !== undefined && { read }),
      ...(type && { type }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
  });

  return notifications.map((n) => ({
    ...n,
    data: (n.data as Record<string, unknown>) || null,
  }));
}

/**
 * Mark a notification as read
 * @throws Error if notification doesn't belong to user
 */
export async function markRead(
  notificationId: string,
  userId: string
): Promise<Notification> {
  // Verify ownership before updating
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  });

  if (!existing) {
    throw new Error('Notification not found');
  }

  if (existing.userId !== userId) {
    throw new Error('Unauthorized: notification belongs to another user');
  }

  const notification = await prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      read: true,
    },
  });

  return {
    ...notification,
    data: (notification.data as Record<string, unknown>) || null,
  };
}

/**
 * Mark multiple notifications as read
 * Only updates notifications belonging to the user
 */
export async function markManyRead(
  notificationIds: string[],
  userId: string
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      id: {
        in: notificationIds,
      },
      userId, // Only update notifications belonging to this user
    },
    data: {
      read: true,
    },
  });

  return result.count;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
    },
  });

  return result.count;
}

/**
 * Get unread count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const count = await prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  });

  return count;
}

/**
 * Delete a notification
 * @throws Error if notification doesn't belong to user
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<void> {
  // Verify ownership before deleting
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  });

  if (!existing) {
    throw new Error('Notification not found');
  }

  if (existing.userId !== userId) {
    throw new Error('Unauthorized: notification belongs to another user');
  }

  await prisma.notification.delete({
    where: {
      id: notificationId,
    },
  });
}

/**
 * Delete old read notifications (cleanup)
 */
export async function deleteOldRead(userId: string, daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.notification.deleteMany({
    where: {
      userId,
      read: true,
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}
