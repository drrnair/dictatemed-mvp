// src/hooks/useNotifications.ts
// React hook for managing notifications with polling

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useNotificationStore } from '@/stores/notification.store';
import { useToast } from '@/hooks/use-toast';
import type { Notification } from '@/domains/notifications/notification.types';

const POLL_INTERVAL = 30000; // 30 seconds

interface UseNotificationsOptions {
  enablePolling?: boolean;
  pollInterval?: number;
  showToast?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    enablePolling = true,
    pollInterval = POLL_INTERVAL,
    showToast = true,
  } = options;

  const { toast } = useToast();
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastNotificationIdRef = useRef<string | null>(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    setNotifications,
    addNotification,
    updateNotification,
    setUnreadCount,
    setLoading,
    setError,
    setLastChecked,
    markAllAsRead: markAllAsReadStore,
  } = useNotificationStore();

  /**
   * Fetch notifications from the API
   */
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/notifications');

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      const fetchedNotifications: Notification[] = data.notifications.map((n: any) => ({
        ...n,
        createdAt: new Date(n.createdAt),
      }));

      setNotifications(fetchedNotifications);
      setLastChecked(new Date());

      // Show toast for new notifications
      if (showToast && fetchedNotifications.length > 0) {
        const latestNotification = fetchedNotifications[0];

        // Only show toast if this is a new notification we haven't seen
        if (
          latestNotification &&
          !latestNotification.read &&
          latestNotification.id !== lastNotificationIdRef.current
        ) {
          lastNotificationIdRef.current = latestNotification.id;

          toast({
            title: latestNotification.title,
            description: latestNotification.message,
            variant: 'default',
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
      setError(message);
      // Error logged for debugging but not surfaced to user beyond error state
    } finally {
      setLoading(false);
    }
  }, [setNotifications, setLoading, setError, setLastChecked, showToast, toast]);

  /**
   * Mark a notification as read
   */
  const markRead = useCallback(
    async (notificationId: string) => {
      try {
        const response = await fetch('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'markRead',
            notificationId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to mark notification as read');
        }

        updateNotification(notificationId, { read: true });
      } catch (err) {
        // Error thrown to caller - let them handle display
        throw err;
      }
    },
    [updateNotification]
  );

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'markAllRead',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      markAllAsReadStore();
    } catch (err) {
      // Error thrown to caller - let them handle display
      throw err;
    }
  }, [markAllAsReadStore]);

  /**
   * Refresh notifications manually
   */
  const refresh = useCallback(() => {
    return fetchNotifications();
  }, [fetchNotifications]);

  /**
   * Set up polling for new notifications
   */
  useEffect(() => {
    // Initial fetch
    fetchNotifications();

    // Set up polling
    if (enablePolling) {
      pollTimerRef.current = setInterval(() => {
        fetchNotifications();
      }, pollInterval);
    }

    // Cleanup
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [fetchNotifications, enablePolling, pollInterval]);

  /**
   * Pause and resume polling (useful for visibility changes)
   */
  const pausePolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const resumePolling = useCallback(() => {
    if (enablePolling && !pollTimerRef.current) {
      pollTimerRef.current = setInterval(() => {
        fetchNotifications();
      }, pollInterval);
    }
  }, [enablePolling, pollInterval, fetchNotifications]);

  /**
   * Pause polling when page is hidden
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pausePolling();
      } else {
        resumePolling();
        // Refresh when page becomes visible again
        fetchNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pausePolling, resumePolling, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markRead,
    markAllAsRead,
    refresh,
    pausePolling,
    resumePolling,
  };
}
