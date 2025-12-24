// src/components/recording/AudioQualityIndicator.tsx
// Real-time audio quality meter with new design system colors

'use client';

import { Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AudioQuality = 'excellent' | 'good' | 'fair' | 'poor';

interface AudioQualityIndicatorProps {
  quality: AudioQuality;
  audioLevel: number; // 0-1 normalized level
  className?: string;
}

const qualityConfig = {
  excellent: {
    icon: CheckCircle,
    label: 'Excellent',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800/50',
    barColor: 'bg-emerald-500',
    description: 'Clear audio signal',
  },
  good: {
    icon: CheckCircle,
    label: 'Good',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    borderColor: 'border-teal-200 dark:border-teal-800/50',
    barColor: 'bg-teal-500',
    description: 'Audio quality is good',
  },
  fair: {
    icon: AlertTriangle,
    label: 'Fair',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
    barColor: 'bg-amber-500',
    description: 'Consider moving closer to mic',
  },
  poor: {
    icon: XCircle,
    label: 'Poor',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-200 dark:border-rose-800/50',
    barColor: 'bg-rose-500',
    description: 'Audio quality is low',
  },
};

export function AudioQualityIndicator({
  quality,
  audioLevel,
  className,
}: AudioQualityIndicatorProps) {
  const config = qualityConfig[quality];
  const Icon = config.icon;

  return (
    <div className={cn('rounded-xl border p-4', config.bgColor, config.borderColor, className)}>
      <div className="flex items-center gap-3">
        <Icon className={cn('h-5 w-5', config.color)} />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className={cn('text-sm font-medium', config.color)}>{config.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {Math.round(audioLevel * 100)}%
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{config.description}</p>
        </div>
      </div>

      {/* Level meter */}
      <div className="mt-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        <div className="flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className={cn('h-full rounded-full transition-all duration-100', config.barColor)}
              style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact quality badge
interface QualityBadgeProps {
  quality: AudioQuality;
  className?: string;
}

export function QualityBadge({ quality, className }: QualityBadgeProps) {
  const config = qualityConfig[quality];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}
