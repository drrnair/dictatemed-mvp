// src/components/recording/AudioQualityIndicator.tsx
// Real-time audio quality meter based on signal level

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
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    description: 'Clear audio signal',
  },
  good: {
    icon: CheckCircle,
    label: 'Good',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    description: 'Audio quality is good',
  },
  fair: {
    icon: AlertTriangle,
    label: 'Fair',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    description: 'Consider moving closer to mic',
  },
  poor: {
    icon: XCircle,
    label: 'Poor',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
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
    <div className={cn('rounded-lg border p-4', config.bgColor, className)}>
      <div className="flex items-center gap-3">
        <Icon className={cn('h-5 w-5', config.color)} />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className={cn('font-medium', config.color)}>{config.label}</p>
            <p className="text-sm text-muted-foreground">
              {Math.round(audioLevel * 100)}%
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Level meter */}
      <div className="mt-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all duration-100', {
                'bg-green-500': quality === 'excellent',
                'bg-primary': quality === 'good',
                'bg-yellow-500': quality === 'fair',
                'bg-destructive': quality === 'poor',
              })}
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
