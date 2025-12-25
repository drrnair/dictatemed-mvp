'use client';

// src/components/referral/ConfidenceIndicator.tsx
// Visual indicator for extraction confidence scores

import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  HIGH_CONFIDENCE_THRESHOLD,
  MEDIUM_CONFIDENCE_THRESHOLD,
} from '@/domains/referrals';

export interface ConfidenceIndicatorProps {
  confidence: number; // 0-1
  showPercentage?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ConfidenceIndicator({
  confidence,
  showPercentage = false,
  size = 'sm',
  className,
}: ConfidenceIndicatorProps) {
  const percentage = Math.round(confidence * 100);
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const getConfidenceLevel = () => {
    if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return 'high';
    if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
    return 'low';
  };

  const level = getConfidenceLevel();

  const config = {
    high: {
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      label: 'High confidence',
      description: 'Information was clearly stated',
    },
    medium: {
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      label: 'Medium confidence',
      description: 'Please verify this information',
    },
    low: {
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      label: 'Low confidence',
      description: 'Information may be inaccurate',
    },
  };

  const { icon: Icon, color, bgColor, label, description } = config[level];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
              bgColor,
              className
            )}
            role="status"
            aria-label={`${label}: ${percentage}%`}
            data-testid="confidence-indicator"
            data-confidence-level={level}
            data-confidence-value={percentage}
          >
            <Icon className={cn(iconSize, color)} />
            {showPercentage && (
              <span className={cn('text-xs font-medium', color)}>
                {percentage}%
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{label} ({percentage}%)</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Simpler inline version without tooltip
export function ConfidenceIndicatorInline({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const percentage = Math.round(confidence * 100);

  const getColor = () => {
    if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return 'text-green-600';
    if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <span className={cn('text-xs font-medium', getColor(), className)}>
      {percentage}%
    </span>
  );
}
