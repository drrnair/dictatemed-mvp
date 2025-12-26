'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { GripVertical, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  /** Initial width percentage (default: 40) */
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
  title = 'Clinical Literature',
  headerContent,
  initialWidth = 400,
  minWidth = 320,
  maxWidth = 640,
  className,
}: SidePanelLayoutProps) {
  const [width, setWidth] = useState(initialWidth);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startWidthRef.current = width;

      const clientX = 'touches' in e ? e.touches[0]!.clientX : e.clientX;
      startXRef.current = clientX;

      const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
        const moveClientX =
          'touches' in moveEvent
            ? moveEvent.touches[0]!.clientX
            : moveEvent.clientX;
        const delta = startXRef.current - moveClientX;
        const newWidth = Math.max(
          minWidth,
          Math.min(maxWidth, startWidthRef.current + delta)
        );
        setWidth(newWidth);
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
    [width, minWidth, maxWidth]
  );

  // Toggle minimize
  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  if (!isOpen) return null;

  // Minimized state - thin edge strip
  if (isMinimized) {
    return (
      <motion.div
        initial={{ x: 48 }}
        animate={{ x: 0 }}
        exit={{ x: 48 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed top-0 right-0 h-full w-12 bg-card border-l shadow-lg z-50 flex flex-col items-center py-4"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMinimize}
          className="h-10 w-10"
          aria-label="Expand panel"
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
        </Button>
      </motion.div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <motion.div
        ref={panelRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{ width: `${width}px` }}
        className={cn(
          'fixed top-0 right-0 h-full bg-card border-l shadow-lg z-50',
          'flex flex-col',
          isResizing && 'select-none',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="side-panel-title"
      >
        {/* Resize handle */}
        <button
          type="button"
          className={cn(
            'absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize',
            'hover:bg-primary/20 transition-colors',
            'flex items-center justify-center',
            'bg-transparent border-0 p-0',
            isResizing && 'bg-primary/20'
          )}
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          aria-label="Resize panel"
        >
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
            <GripVertical className="h-6 w-6 text-muted-foreground" />
          </div>
        </button>

        {/* Header */}
        {headerContent || (
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <h2
              id="side-panel-title"
              className="font-semibold text-foreground"
            >
              {title}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMinimize}
                className="h-8 w-8"
                aria-label="Minimize panel"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </motion.div>
    </>
  );
}
