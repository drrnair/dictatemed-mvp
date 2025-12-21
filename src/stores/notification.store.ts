// src/stores/notification.store.ts
// Zustand store for notification state management

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Notification } from '@/domains/notifications/notification.types';

interface NotificationState {
  // Notification data
  notifications: Notification[];
  unreadCount: number;
  lastChecked: Date | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
  removeNotification: (id: string) => void;
  setUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;
  setLastChecked: (date: Date) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Bulk actions
  markAllAsRead: () => void;
  clearAll: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  notifications: [],
  unreadCount: 0,
  lastChecked: null,
  isLoading: false,
  error: null,
};

export const useNotificationStore = create<NotificationState>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    setNotifications: (notifications) =>
      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      }),

    addNotification: (notification) =>
      set((state) => ({
        notifications: [notification, ...state.notifications],
        unreadCount: notification.read ? state.unreadCount : state.unreadCount + 1,
      })),

    updateNotification: (id, updates) =>
      set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, ...updates } : n
        );
        const unreadCount = notifications.filter((n) => !n.read).length;
        return { notifications, unreadCount };
      }),

    removeNotification: (id) =>
      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        const notifications = state.notifications.filter((n) => n.id !== id);
        const unreadCount = notification?.read
          ? state.unreadCount
          : Math.max(0, state.unreadCount - 1);
        return { notifications, unreadCount };
      }),

    setUnreadCount: (unreadCount) => set({ unreadCount }),

    incrementUnreadCount: () =>
      set((state) => ({ unreadCount: state.unreadCount + 1 })),

    decrementUnreadCount: () =>
      set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),

    setLastChecked: (lastChecked) => set({ lastChecked }),

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),

    markAllAsRead: () =>
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      })),

    clearAll: () =>
      set({
        notifications: [],
        unreadCount: 0,
      }),

    reset: () => set(initialState),
  }))
);

// Selectors
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;
export const selectHasUnread = (state: NotificationState) => state.unreadCount > 0;
export const selectUnreadNotifications = (state: NotificationState) =>
  state.notifications.filter((n) => !n.read);
export const selectRecentNotifications = (state: NotificationState, limit: number = 10) =>
  state.notifications.slice(0, limit);
