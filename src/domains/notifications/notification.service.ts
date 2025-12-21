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
 */
export async function markRead(notificationId: string): Promise<Notification> {
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
 */
export async function markManyRead(notificationIds: string[]): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      id: {
        in: notificationIds,
      },
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
 */
export async function deleteNotification(notificationId: string): Promise<void> {
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
