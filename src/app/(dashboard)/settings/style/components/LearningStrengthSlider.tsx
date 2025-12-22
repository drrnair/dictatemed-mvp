// src/app/(dashboard)/settings/style/components/LearningStrengthSlider.tsx
// Slider component for adjusting style learning strength

'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LearningStrengthSliderProps {
  value: number;
  onChange: (value: number) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

/**
 * Slider for adjusting how aggressively the system applies learned style preferences.
 * - 0.0 = No adaptation (neutral/default style)
 * - 0.5 = Moderate adaptation
 * - 1.0 = Full adaptation (strongly applies learned preferences)
 */
export function LearningStrengthSlider({
  value,
  onChange,
  disabled = false,
  className,
}: LearningStrengthSliderProps) {
  // Local state for immediate feedback while dragging
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync local value with prop
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
  }, []);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(async () => {
    setIsDragging(false);
    if (localValue !== value) {
      setIsSaving(true);
      try {
        await onChange(localValue);
      } finally {
        setIsSaving(false);
      }
    }
  }, [localValue, value, onChange]);

  // Get label based on value
  const getStrengthLabel = (val: number): string => {
    if (val <= 0.2) return 'Minimal';
    if (val <= 0.4) return 'Light';
    if (val <= 0.6) return 'Moderate';
    if (val <= 0.8) return 'Strong';
    return 'Full';
  };

  // Get color based on value
  const getStrengthColor = (val: number): string => {
    if (val <= 0.2) return 'bg-gray-400';
    if (val <= 0.4) return 'bg-blue-400';
    if (val <= 0.6) return 'bg-blue-500';
    if (val <= 0.8) return 'bg-blue-600';
    return 'bg-primary';
  };

  const displayValue = Math.round(localValue * 100);

  return (
    <div className={cn('space-y-1', className)}>
      {/* Slider Track */}
      <div className="relative">
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={localValue}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
          disabled={disabled || isSaving}
          className={cn(
            'w-full h-2 rounded-full appearance-none cursor-pointer',
            'bg-secondary',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:h-4',
            '[&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-primary',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:shadow-md',
            '[&::-webkit-slider-thumb]:transition-transform',
            '[&::-webkit-slider-thumb]:hover:scale-110',
            '[&::-moz-range-thumb]:h-4',
            '[&::-moz-range-thumb]:w-4',
            '[&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-primary',
            '[&::-moz-range-thumb]:border-0',
            '[&::-moz-range-thumb]:cursor-pointer',
            disabled && 'opacity-50 cursor-not-allowed',
            isSaving && 'opacity-70'
          )}
        />
        {/* Progress Fill */}
        <div
          className={cn(
            'absolute top-0 left-0 h-2 rounded-l-full pointer-events-none transition-all',
            getStrengthColor(localValue)
          )}
          style={{ width: `${displayValue}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Neutral</span>
        <span className={cn(
          'font-medium px-2 py-0.5 rounded',
          localValue > 0.5 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        )}>
          {getStrengthLabel(localValue)}
          {isSaving && ' (saving...)'}
        </span>
        <span className="text-muted-foreground">Personalized</span>
      </div>
    </div>
  );
}

/**
 * Preset buttons for quick strength selection.
 */
interface LearningStrengthPresetsProps {
  value: number;
  onChange: (value: number) => Promise<void>;
  disabled?: boolean;
}

export function LearningStrengthPresets({
  value,
  onChange,
  disabled = false,
}: LearningStrengthPresetsProps) {
  const [isSaving, setIsSaving] = useState(false);

  const presets = [
    { label: 'Off', value: 0, description: 'Use default style' },
    { label: 'Light', value: 0.3, description: 'Subtle personalization' },
    { label: 'Medium', value: 0.6, description: 'Balanced approach' },
    { label: 'Full', value: 1.0, description: 'Maximum personalization' },
  ];

  const handlePresetClick = async (presetValue: number) => {
    if (presetValue !== value) {
      setIsSaving(true);
      try {
        await onChange(presetValue);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="flex gap-2">
      {presets.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => handlePresetClick(preset.value)}
          disabled={disabled || isSaving}
          className={cn(
            'flex-1 px-3 py-2 text-sm rounded-md border transition-all',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            Math.abs(value - preset.value) < 0.05
              ? 'border-primary bg-primary/10 text-primary font-medium'
              : 'border-border hover:border-primary/50 hover:bg-muted/50',
            (disabled || isSaving) && 'opacity-50 cursor-not-allowed'
          )}
          title={preset.description}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
