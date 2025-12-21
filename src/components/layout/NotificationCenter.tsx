// src/components/layout/NotificationCenter.tsx
// Notification center dropdown component

'use client';

import * as React from 'react';
import { Bell, Check, CheckCheck, AlertCircle, FileText, FileCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification, NotificationType } from '@/domains/notifications/notification.types';
import { cn } from '@/lib/utils';

const NOTIFICATION_DISPLAY_LIMIT = 10;

/**
 * Get icon for notification type
 */
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'LETTER_READY':
      return <FileText className="h-4 w-4 text-blue-600" />;
    case 'TRANSCRIPTION_COMPLETE':
      return <Check className="h-4 w-4 text-green-600" />;
    case 'DOCUMENT_PROCESSED':
      return <FileCheck className="h-4 w-4 text-purple-600" />;
    case 'REVIEW_REMINDER':
      return <AlertCircle className="h-4 w-4 text-orange-600" />;
    case 'SYSTEM':
      return <Bell className="h-4 w-4 text-gray-600" />;
    default:
      return <Bell className="h-4 w-4 text-gray-600" />;
  }
}

/**
 * Get notification action URL
 */
function getNotificationUrl(notification: Notification): string | null {
  if (notification.data?.url) {
    return notification.data.url as string;
  }

  if (notification.data?.letterId) {
    return `/letters/${notification.data.letterId}`;
  }

  if (notification.data?.recordingId) {
    return `/recordings/${notification.data.recordingId}`;
  }

  if (notification.data?.documentId) {
    return `/documents/${notification.data.documentId}`;
  }

  return null;
}

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onClose: () => void;
}

function NotificationItem({ notification, onMarkRead, onClose }: NotificationItemProps) {
  const url = getNotificationUrl(notification);

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }

    if (url) {
      window.location.href = url;
    }

    onClose();
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead(notification.id);
  };

  return (
    <DropdownMenuItem
      className={cn(
        'flex cursor-pointer items-start gap-3 p-3',
        !notification.read && 'bg-blue-50/50'
      )}
      onClick={handleClick}
    >
      <div className="flex-shrink-0 pt-0.5">{getNotificationIcon(notification.type)}</div>
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium', !notification.read && 'font-semibold')}>
            {notification.title}
          </p>
          {!notification.read && (
            <button
              onClick={handleMarkRead}
              className="flex-shrink-0 rounded p-1 hover:bg-gray-100"
              title="Mark as read"
            >
              <Check className="h-3 w-3 text-gray-500" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600">{notification.message}</p>
        <p className="text-xs text-gray-400">
          {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
        </p>
      </div>
    </DropdownMenuItem>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = React.useState(false);
  const { notifications, unreadCount, isLoading, markRead, markAllAsRead } = useNotifications();

  const displayedNotifications = notifications.slice(0, NOTIFICATION_DISPLAY_LIMIT);
  const hasMore = notifications.length > NOTIFICATION_DISPLAY_LIMIT;

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await markRead(notificationId);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-[1.25rem] px-1 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[400px] p-0">
        <div className="flex items-center justify-between border-b p-4">
          <DropdownMenuLabel className="p-0 font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-auto p-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        {isLoading && notifications.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <div className="text-sm text-gray-500">Loading notifications...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <Bell className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">No notifications</p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[400px]">
              <div className="divide-y">
                {displayedNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                    onClose={() => setOpen(false)}
                  />
                ))}
              </div>
            </ScrollArea>

            {hasMore && (
              <>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-blue-600 hover:text-blue-700"
                    onClick={() => {
                      window.location.href = '/notifications';
                      setOpen(false);
                    }}
                  >
                    View all notifications ({notifications.length})
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
