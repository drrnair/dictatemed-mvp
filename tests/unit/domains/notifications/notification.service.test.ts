// tests/unit/domains/notifications/notification.service.test.ts
// Tests for notification service (unit tests with mocked Prisma)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as notificationService from '@/domains/notifications/notification.service';
import { prisma } from '@/infrastructure/db/client';
import type { NotificationType } from '@/domains/notifications/notification.types';

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('notification.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification with correct data', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-1',
        type: 'SYSTEM' as NotificationType,
        title: 'Test Title',
        message: 'Test Message',
        data: { key: 'value' },
        read: false,
        createdAt: new Date(),
      };

      vi.mocked(prisma.notification.create).mockResolvedValue(mockNotification);

      const result = await notificationService.create(
        'user-1',
        'SYSTEM',
        'Test Title',
        'Test Message',
        { key: 'value' }
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'SYSTEM',
          title: 'Test Title',
          message: 'Test Message',
          data: { key: 'value' },
        },
      });
      expect(result.id).toBe('notif-1');
      expect(result.data).toEqual({ key: 'value' });
    });
  });

  describe('getUnread', () => {
    it('should return unread notifications for a user', async () => {
      const mockNotifications = [
        { id: 'notif-1', userId: 'user-1', type: 'SYSTEM' as NotificationType, title: 'Title 1', message: 'Msg 1', read: false, data: null, createdAt: new Date() },
        { id: 'notif-2', userId: 'user-1', type: 'LETTER_READY' as NotificationType, title: 'Title 2', message: 'Msg 2', read: false, data: { foo: 'bar' }, createdAt: new Date() },
      ];

      vi.mocked(prisma.notification.findMany).mockResolvedValue(mockNotifications);

      const result = await notificationService.getUnread('user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]!.data).toBeNull();
      expect(result[1]!.data).toEqual({ foo: 'bar' });
    });
  });

  describe('markRead', () => {
    it('should mark a notification as read when user owns it', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-1',
        type: 'SYSTEM' as NotificationType,
        title: 'Title',
        message: 'Msg',
        read: true,
        data: null,
        createdAt: new Date(),
      };

      vi.mocked(prisma.notification.findUnique).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(prisma.notification.update).mockResolvedValue(mockNotification);

      const result = await notificationService.markRead('notif-1', 'user-1');

      expect(prisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        select: { userId: true },
      });
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { read: true },
      });
      expect(result.read).toBe(true);
    });

    it('should throw error when notification not found', async () => {
      vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);

      await expect(notificationService.markRead('notif-1', 'user-1')).rejects.toThrow('Notification not found');
    });

    it('should throw error when user does not own notification', async () => {
      vi.mocked(prisma.notification.findUnique).mockResolvedValue({ userId: 'other-user' } as any);

      await expect(notificationService.markRead('notif-1', 'user-1')).rejects.toThrow('Unauthorized: notification belongs to another user');
    });
  });

  describe('markManyRead', () => {
    it('should only update notifications belonging to the user', async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 2 });

      const result = await notificationService.markManyRead(['notif-1', 'notif-2', 'notif-3'], 'user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['notif-1', 'notif-2', 'notif-3'] },
          userId: 'user-1', // Authorization filter
        },
        data: { read: true },
      });
      expect(result).toBe(2);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification when user owns it', async () => {
      vi.mocked(prisma.notification.findUnique).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(prisma.notification.delete).mockResolvedValue({} as any);

      await notificationService.deleteNotification('notif-1', 'user-1');

      expect(prisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        select: { userId: true },
      });
      expect(prisma.notification.delete).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });
    });

    it('should throw error when notification not found', async () => {
      vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);

      await expect(notificationService.deleteNotification('notif-1', 'user-1')).rejects.toThrow('Notification not found');
    });

    it('should throw error when user does not own notification', async () => {
      vi.mocked(prisma.notification.findUnique).mockResolvedValue({ userId: 'other-user' } as any);

      await expect(notificationService.deleteNotification('notif-1', 'user-1')).rejects.toThrow('Unauthorized: notification belongs to another user');
    });
  });

  describe('markAllRead', () => {
    it('should mark all unread notifications as read for user', async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 5 });

      const result = await notificationService.markAllRead('user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          read: false,
        },
        data: { read: true },
      });
      expect(result).toBe(5);
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      vi.mocked(prisma.notification.count).mockResolvedValue(3);

      const result = await notificationService.getUnreadCount('user-1');

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          read: false,
        },
      });
      expect(result).toBe(3);
    });
  });

  describe('deleteOldRead', () => {
    it('should delete read notifications older than specified days', async () => {
      vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 10 });

      const result = await notificationService.deleteOldRead('user-1', 30);

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          read: true,
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
      expect(result).toBe(10);
    });
  });

  describe('getAll', () => {
    it('should apply filters correctly', async () => {
      vi.mocked(prisma.notification.findMany).mockResolvedValue([]);

      await notificationService.getAll({
        userId: 'user-1',
        read: true,
        type: 'SYSTEM',
        limit: 20,
        offset: 10,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          read: true,
          type: 'SYSTEM',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 10,
      });
    });

    it('should use defaults for limit and offset', async () => {
      vi.mocked(prisma.notification.findMany).mockResolvedValue([]);

      await notificationService.getAll({ userId: 'user-1' });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });
  });
});
