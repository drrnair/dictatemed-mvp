// src/components/recording/WaveformVisualizer.tsx
// Real-time audio waveform visualization with teal theme

'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WaveformVisualizerProps {
  audioLevel: number; // 0-1 normalized level
  isActive: boolean;
  barCount?: number;
  className?: string;
}

export function WaveformVisualizer({
  audioLevel,
  isActive,
  barCount = 32,
  className,
}: WaveformVisualizerProps) {
  const barsRef = useRef<number[]>(Array(barCount).fill(0));

  // Update bars with audio level
  useEffect(() => {
    if (!isActive) {
      barsRef.current = Array(barCount).fill(0);
      return;
    }

    // Create wave effect by updating bars
    const newBars = [...barsRef.current];
    // Shift bars left
    for (let i = 0; i < barCount - 1; i++) {
      newBars[i] = newBars[i + 1] ?? 0;
    }
    // Add new value with some randomness for visual interest
    const variation = 0.3 * (Math.random() - 0.5);
    newBars[barCount - 1] = Math.max(0, Math.min(1, audioLevel + variation));
    barsRef.current = newBars;
  }, [audioLevel, isActive, barCount]);

  // Generate bars with mirrored effect
  const bars = barsRef.current.map((height, index) => {
    // Add wave motion based on position
    const wave = isActive
      ? Math.sin((index / barCount) * Math.PI * 2 + Date.now() / 200) * 0.1
      : 0;
    const finalHeight = Math.max(0.05, Math.min(1, height + wave));

    return (
      <div
        key={index}
        className="relative flex-1"
        style={{ minWidth: '2px', maxWidth: '8px' }}
      >
        {/* Top bar */}
        <div
          className={cn(
            'absolute bottom-1/2 w-full rounded-t-full transition-all duration-75',
            isActive
              ? 'bg-gradient-to-t from-teal-500 to-teal-400'
              : 'bg-slate-200 dark:bg-slate-700'
          )}
          style={{
            height: `${finalHeight * 50}%`,
          }}
        />
        {/* Bottom bar (mirror) */}
        <div
          className={cn(
            'absolute top-1/2 w-full rounded-b-full transition-all duration-75',
            isActive
              ? 'bg-gradient-to-b from-teal-500 to-teal-400'
              : 'bg-slate-200 dark:bg-slate-700'
          )}
          style={{
            height: `${finalHeight * 50}%`,
          }}
        />
      </div>
    );
  });

  return (
    <div
      className={cn(
        'flex h-24 items-center justify-center gap-0.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 border border-slate-200 dark:border-slate-700',
        isActive && 'bg-teal-50/50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800/50',
        className
      )}
    >
      {bars}
    </div>
  );
}

// Simple bar visualizer for compact display
interface AudioLevelBarProps {
  level: number; // 0-1 normalized level
  className?: string;
}

export function AudioLevelBar({ level, className }: AudioLevelBarProps) {
  // Color based on level - teal for normal, rose for clipping
  const getColor = () => {
    if (level > 0.8) return 'bg-rose-500';
    if (level > 0.5) return 'bg-teal-500';
    return 'bg-teal-400';
  };

  return (
    <div
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700',
        className
      )}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-75', getColor())}
        style={{ width: `${Math.min(100, level * 100)}%` }}
      />
    </div>
  );
}
