// src/components/recording/WaveformVisualizer.tsx
// Real-time audio waveform visualization

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
            'absolute bottom-1/2 w-full rounded-t-full bg-primary transition-all duration-75',
            !isActive && 'bg-muted'
          )}
          style={{
            height: `${finalHeight * 50}%`,
          }}
        />
        {/* Bottom bar (mirror) */}
        <div
          className={cn(
            'absolute top-1/2 w-full rounded-b-full bg-primary transition-all duration-75',
            !isActive && 'bg-muted'
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
        'flex h-24 items-center justify-center gap-0.5 rounded-lg bg-muted/50 px-4',
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
  // Color based on level
  const getColor = () => {
    if (level > 0.8) return 'bg-destructive';
    if (level > 0.5) return 'bg-primary';
    return 'bg-primary/60';
  };

  return (
    <div
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-muted',
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
