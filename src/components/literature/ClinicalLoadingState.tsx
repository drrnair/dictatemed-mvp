'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Globe, Sparkles, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  loadingStageVariants,
  loadingTextVariants,
  durations,
} from '@/styles/clinical-animations';

/**
 * Loading stages with source-by-source feedback.
 * Each stage shows what the system is currently searching.
 */
const LOADING_STAGES = [
  {
    icon: FileText,
    text: 'Searching your library...',
    color: 'text-verified-600',
    bgColor: 'bg-verified-100',
  },
  {
    icon: Globe,
    text: 'Checking PubMed...',
    color: 'text-clinical-blue-600',
    bgColor: 'bg-clinical-blue-100',
  },
  {
    icon: BookOpen,
    text: 'Querying UpToDate...',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  {
    icon: Sparkles,
    text: 'Synthesizing results...',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
] as const;

/** Duration each stage is shown (in ms) */
const STAGE_DURATION = 1500;

interface ClinicalLoadingStateProps {
  /** Additional class names */
  className?: string;
  /** Optional message to display below the spinner */
  message?: string;
  /** Compact mode for inline display */
  compact?: boolean;
}

/**
 * Progressive loading indicator for clinical literature search.
 *
 * Features:
 * - Source-by-source feedback (library → PubMed → UpToDate → synthesis)
 * - Cycling icon animation
 * - Progress dots showing current stage
 * - Smooth crossfade between stages
 *
 * Design notes:
 * - Uses clinical color palette for each source
 * - Custom spinner with centered icon
 * - Stage indicator dots for visual progress
 */
export function ClinicalLoadingState({
  className,
  message,
  compact = false,
}: ClinicalLoadingStateProps) {
  const [stage, setStage] = useState(0);

  // Cycle through stages
  useEffect(() => {
    const interval = setInterval(() => {
      setStage((s) => (s + 1) % LOADING_STAGES.length);
    }, STAGE_DURATION);

    return () => clearInterval(interval);
  }, []);

  // TypeScript needs explicit bounds check even though stage is always in range
  const currentStage = stage % LOADING_STAGES.length;
  const current = LOADING_STAGES[currentStage]!;
  const Icon = current.icon;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {/* Compact spinner */}
        <div className="relative w-5 h-5">
          <motion.div
            className="absolute inset-0 border-2 border-clinical-gray-200 rounded-full"
          />
          <motion.div
            className="absolute inset-0 border-2 border-t-clinical-blue-600 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* Text */}
        <AnimatePresence mode="wait">
          <motion.span
            key={stage}
            variants={loadingTextVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="text-sm text-clinical-gray-600 font-ui-sans"
          >
            {message || current.text}
          </motion.span>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center py-16', className)}>
      {/* Spinner with icon */}
      <div className="relative w-16 h-16 mb-4">
        {/* Background ring */}
        <motion.div
          className="absolute inset-0 border-4 border-clinical-gray-200 rounded-full"
        />

        {/* Spinning ring */}
        <motion.div
          className="absolute inset-0 border-4 border-t-clinical-blue-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />

        {/* Centered icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              variants={loadingStageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                current.bgColor
              )}
            >
              <Icon className={cn('w-5 h-5', current.color)} strokeWidth={2} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Text (crossfades) */}
      <AnimatePresence mode="wait">
        <motion.p
          key={stage}
          variants={loadingTextVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="text-sm text-clinical-gray-600 font-medium font-ui-sans"
        >
          {message || current.text}
        </motion.p>
      </AnimatePresence>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mt-4">
        {LOADING_STAGES.map((_, idx) => (
          <motion.div
            key={idx}
            className={cn(
              'w-2 h-2 rounded-full transition-colors duration-200',
              idx === stage ? 'bg-clinical-blue-600' : 'bg-clinical-gray-300'
            )}
            animate={{
              scale: idx === stage ? 1.3 : 1,
            }}
            transition={{ duration: durations.fast }}
          />
        ))}
      </div>

      {/* Screen reader announcement */}
      <div role="status" aria-live="polite" className="sr-only">
        {current.text}
      </div>
    </div>
  );
}

/**
 * Inline loading indicator for use within search results.
 * Shows a simple spinner with optional text.
 */
export function InlineLoadingState({
  text = 'Loading...',
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 text-clinical-gray-500', className)}>
      <motion.div
        className="w-4 h-4 border-2 border-clinical-gray-200 border-t-clinical-blue-500 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <span className="text-sm font-ui-sans">{text}</span>
    </div>
  );
}
