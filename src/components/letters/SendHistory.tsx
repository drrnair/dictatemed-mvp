// src/components/letters/SendHistory.tsx
// Display send history for a letter with retry functionality

'use client';

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Send,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Mail,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SendStatus, ContactType } from '@prisma/client';

interface SendHistoryItem {
  id: string;
  recipientName: string;
  recipientEmail: string;
  recipientType: ContactType | null;
  channel: string;
  subject: string;
  status: SendStatus;
  queuedAt: string;
  sentAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
}

interface SendHistoryProps {
  letterId: string;
  history: SendHistoryItem[];
  onRetry?: (sendId: string) => Promise<void>;
  className?: string;
}

export function SendHistory({
  letterId,
  history,
  onRetry,
  className,
}: SendHistoryProps) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetry = useCallback(
    async (sendId: string) => {
      if (!onRetry) return;

      setRetryingId(sendId);
      setRetryError(null);

      try {
        await onRetry(sendId);
      } catch (error) {
        setRetryError(error instanceof Error ? error.message : 'Retry failed');
      } finally {
        setRetryingId(null);
      }
    },
    [onRetry]
  );

  const getStatusIcon = (status: SendStatus) => {
    switch (status) {
      case 'SENT':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'FAILED':
      case 'BOUNCED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'QUEUED':
      case 'SENDING':
        return <Clock className="h-4 w-4 text-amber-600" />;
      default:
        return <Mail className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: SendStatus) => {
    const variants: Record<SendStatus, 'verified' | 'destructive' | 'warning' | 'default'> = {
      SENT: 'verified',
      FAILED: 'destructive',
      BOUNCED: 'destructive',
      QUEUED: 'warning',
      SENDING: 'warning',
    };

    return (
      <Badge variant={variants[status] || 'default'} className="text-xs">
        {status}
      </Badge>
    );
  };

  const getTypeLabel = (type: ContactType | null) => {
    if (!type) return null;
    const labels: Record<ContactType, string> = {
      GP: 'GP',
      REFERRER: 'Referrer',
      SPECIALIST: 'Specialist',
      OTHER: 'Other',
    };
    return labels[type];
  };

  const formatTimestamp = (date: string | null) => {
    if (!date) return '—';
    return format(new Date(date), 'dd MMM yyyy, HH:mm');
  };

  if (history.length === 0) {
    return (
      <div className={cn('rounded-lg border border-dashed p-6 text-center', className)}>
        <Send className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          This letter has not been sent yet.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Send History</h3>
          <span className="text-xs text-muted-foreground">
            {history.length} send{history.length !== 1 ? 's' : ''}
          </span>
        </div>

        {retryError && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {retryError}
          </div>
        )}

        <div className="space-y-2">
          {history.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-3 transition-colors',
                item.status === 'FAILED' && 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30'
              )}
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(item.status)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.recipientName}</span>
                    {item.recipientType && (
                      <Badge variant="outline" className="text-[10px] py-0">
                        {getTypeLabel(item.recipientType)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.recipientEmail}</p>
                  {item.errorMessage && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="mt-1 cursor-help text-xs text-red-600 underline decoration-dotted">
                          Error: {item.errorMessage.substring(0, 40)}
                          {item.errorMessage.length > 40 ? '...' : ''}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{item.errorMessage}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  {getStatusBadge(item.status)}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {item.status === 'SENT'
                      ? formatTimestamp(item.sentAt)
                      : item.status === 'FAILED'
                        ? formatTimestamp(item.failedAt)
                        : formatTimestamp(item.queuedAt)}
                  </p>
                </div>

                {item.status === 'FAILED' && onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetry(item.id)}
                    disabled={retryingId === item.id}
                    className="h-8"
                  >
                    {retryingId === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Retry
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
