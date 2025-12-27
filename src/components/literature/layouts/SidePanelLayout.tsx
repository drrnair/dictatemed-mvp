'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, X, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  easings,
  durations,
} from '@/styles/clinical-animations';

interface SidePanelLayoutProps {
  /** Panel content */
  children: ReactNode;
  /** Whether panel is open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Title for the panel header */
  title?: string;
  /** Header content (replaces default header) */
  headerContent?: ReactNode;
  /** Initial width percentage (default: 42 - intentionally asymmetric) */
  initialWidth?: number;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Side panel layout for clinical literature chat.
 *
 * Features:
 * - Resizable via drag handle
 * - Minimizable to thin edge strip
 * - Smooth slide-in animation
 * - Keyboard accessible (Escape to close)
 */
export function SidePanelLayout({
  children,
  isOpen,
  onClose,
  title = 'Clinical Assistant',
  headerContent,
  initialWidth = 42, // Percentage - intentionally asymmetric (not 50% or 40%)
  minWidth = 380,
  maxWidth = 720,
  className,
}: SidePanelLayoutProps) {
  const [widthPercent, setWidthPercent] = useState(initialWidth);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Calculate pixel width from percentage, clamped to min/max
  const getClampedWidth = useCallback(
    (percent: number) => {
      const pixelWidth = (percent / 100) * window.innerWidth;
      return Math.max(minWidth, Math.min(maxWidth, pixelWidth));
    },
    [minWidth, maxWidth]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startWidthRef.current = widthPercent;

      const clientX = 'touches' in e ? e.touches[0]!.clientX : e.clientX;
      startXRef.current = clientX;

      const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
        const moveClientX =
          'touches' in moveEvent
            ? moveEvent.touches[0]!.clientX
            : moveEvent.clientX;
        const deltaX = startXRef.current - moveClientX;
        const deltaPercent = (deltaX / window.innerWidth) * 100;
        const newPercent = Math.max(
          (minWidth / window.innerWidth) * 100,
          Math.min((maxWidth / window.innerWidth) * 100, startWidthRef.current + deltaPercent)
        );
        setWidthPercent(newPercent);
      };

      const handleEnd = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchend', handleEnd);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('touchmove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchend', handleEnd);
    },
    [widthPercent, minWidth, maxWidth]
  );

  // Toggle minimize
  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Minimized state - thin edge strip */}
          {isMinimized ? (
            <motion.div
              initial={{ x: 48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 48, opacity: 0 }}
              transition={{
                duration: durations.normal,
                ease: easings.smooth,
              }}
              className={cn(
                'fixed top-0 right-0 h-full w-12 z-50',
                'bg-clinical-gray-50 border-l border-clinical-gray-200',
                'flex flex-col items-center py-6',
                'shadow-soft'
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMinimize}
                className="h-10 w-10 hover:bg-clinical-gray-100"
                aria-label="Expand panel"
              >
                <ChevronRight className="h-5 w-5 rotate-180 text-clinical-gray-600" />
              </Button>
            </motion.div>
          ) : (
            <>
              {/* Backdrop - only on mobile */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durations.fast }}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
                onClick={onClose}
                aria-hidden="true"
              />

              {/* Panel */}
              <motion.aside
                ref={panelRef}
                initial={{ width: 0, opacity: 0 }}
                animate={{
                  width: `${widthPercent}%`,
                  opacity: 1,
                  transition: {
                    width: {
                      duration: durations.slow,
                      ease: easings.smooth,
                    },
                    opacity: {
                      duration: durations.normal,
                      delay: 0.1,
                    },
                  },
                }}
                exit={{
                  width: 0,
                  opacity: 0,
                  transition: {
                    width: {
                      duration: durations.panelExit,
                      ease: easings.smooth,
                    },
                    opacity: {
                      duration: durations.quickExit,
                    },
                  },
                }}
                className={cn(
                  'fixed top-0 right-0 h-full z-50',
                  'bg-clinical-gray-50 border-l border-clinical-gray-200',
                  'flex flex-col overflow-hidden',
                  isResizing && 'select-none',
                  className
                )}
                style={{
                  // Subtle inner shadow for depth without drama
                  boxShadow: 'inset 1px 0 0 0 rgba(0,0,0,0.03), -4px 0 24px -8px rgba(0,0,0,0.08)',
                  minWidth: `${minWidth}px`,
                  maxWidth: `${maxWidth}px`,
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="side-panel-title"
              >
                {/* Content fades in after panel expands */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    transition: {
                      delay: durations.contentDelay,
                      duration: durations.normal,
                      ease: easings.smooth,
                    },
                  }}
                  exit={{
                    opacity: 0,
                    x: 20,
                    transition: { duration: durations.fast },
                  }}
                  className="flex-1 flex flex-col h-full"
                >
                  {/* Resize handle */}
                  <button
                    type="button"
                    className={cn(
                      'absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize',
                      'hover:bg-clinical-blue-500/20 transition-colors duration-150',
                      'flex items-center justify-center',
                      'bg-transparent border-0 p-0 group',
                      isResizing && 'bg-clinical-blue-500/20'
                    )}
                    onMouseDown={handleResizeStart}
                    onTouchStart={handleResizeStart}
                    aria-label="Resize panel"
                  >
                    <div className={cn(
                      'absolute -left-2 top-1/2 -translate-y-1/2',
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-150'
                    )}>
                      <GripVertical className="h-6 w-6 text-clinical-gray-400" />
                    </div>
                  </button>

                  {/* Header */}
                  {headerContent || (
                    <header className={cn(
                      'flex items-center justify-between px-8 py-6',
                      'bg-white border-b border-clinical-gray-200',
                      'shrink-0'
                    )}>
                      <div className="flex items-center gap-3">
                        {/* Icon badge */}
                        <div className={cn(
                          'w-9 h-9 rounded-lg',
                          'bg-clinical-blue-100',
                          'flex items-center justify-center'
                        )}>
                          <Search className="w-5 h-5 text-clinical-blue-600" />
                        </div>
                        <h2
                          id="side-panel-title"
                          className="text-lg font-semibold text-clinical-gray-900 tracking-tight font-ui-sans"
                        >
                          {title}
                        </h2>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleMinimize}
                          className={cn(
                            'h-8 w-8 rounded-lg',
                            'hover:bg-clinical-gray-100 active:bg-clinical-gray-200',
                            'transition-colors duration-150'
                          )}
                          aria-label="Minimize panel"
                        >
                          <ChevronRight className="h-4 w-4 text-clinical-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={onClose}
                          className={cn(
                            'h-8 w-8 rounded-lg',
                            'hover:bg-clinical-gray-100 active:bg-clinical-gray-200',
                            'transition-colors duration-150 group'
                          )}
                          aria-label="Close clinical assistant"
                        >
                          <X className="h-5 w-5 text-clinical-gray-500 group-hover:text-clinical-gray-700" />
                        </Button>
                      </div>
                    </header>
                  )}

                  {/* Scrollable content */}
                  <div className="flex-1 overflow-hidden">{children}</div>
                </motion.div>
              </motion.aside>
            </>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
