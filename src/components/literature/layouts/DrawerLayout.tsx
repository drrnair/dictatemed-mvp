'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { X, ChevronDown, ChevronUp, Search, Maximize2, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  drawerVariants,
  overlayVariants,
  easings,
  durations,
  createSpringTransition,
} from '@/styles/clinical-animations';

interface DrawerLayoutProps {
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
  /** Initial height as viewport percentage (default: 50) */
  initialHeightVh?: number;
  /** Minimum height as viewport percentage */
  minHeightVh?: number;
  /** Maximum height as viewport percentage */
  maxHeightVh?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Bottom drawer layout for clinical literature chat.
 *
 * Features:
 * - Slides up from bottom
 * - Drag handle to resize height
 * - Snap points (minimized, half, full)
 * - Touch-optimized for mobile/tablet
 * - Swipe down to close
 */
export function DrawerLayout({
  children,
  isOpen,
  onClose,
  title = 'Clinical Assistant',
  headerContent,
  initialHeightVh = 50,
  minHeightVh = 30,
  maxHeightVh = 90,
  className,
}: DrawerLayoutProps) {
  const [heightVh, setHeightVh] = useState(initialHeightVh);
  const [isMinimized, setIsMinimized] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Snap points in vh (memoized to avoid recreating on every render)
  const snapPoints = useMemo(
    () => [minHeightVh, 50, maxHeightVh],
    [minHeightVh, maxHeightVh]
  );

  // Find closest snap point
  const getClosestSnapPoint = useCallback(
    (height: number): number => {
      let closest = snapPoints[0]!;
      let minDistance = Math.abs(height - closest);

      for (const point of snapPoints) {
        const distance = Math.abs(height - point);
        if (distance < minDistance) {
          minDistance = distance;
          closest = point;
        }
      }

      return closest;
    },
    [snapPoints]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const velocityY = info.velocity.y;
      const offsetY = info.offset.y;

      // Calculate new height based on drag
      const draggedVh = (offsetY / window.innerHeight) * 100;
      const newHeight = heightVh - draggedVh;

      // If dragged down quickly or past threshold, close
      if (velocityY > 500 || newHeight < minHeightVh - 10) {
        onClose();
        return;
      }

      // Snap to closest point
      const snappedHeight = getClosestSnapPoint(newHeight);
      setHeightVh(snappedHeight);
    },
    [heightVh, minHeightVh, onClose, getClosestSnapPoint]
  );

  // Handle manual resize via touch
  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      startHeightRef.current = heightVh;

      const clientY = 'touches' in e ? e.touches[0]!.clientY : e.clientY;
      startYRef.current = clientY;

      const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
        const moveClientY =
          'touches' in moveEvent
            ? moveEvent.touches[0]!.clientY
            : moveEvent.clientY;
        const deltaY = startYRef.current - moveClientY;
        const deltaVh = (deltaY / window.innerHeight) * 100;
        const newHeight = Math.max(
          minHeightVh,
          Math.min(maxHeightVh, startHeightRef.current + deltaVh)
        );
        setHeightVh(newHeight);
      };

      const handleEnd = () => {
        // Snap to closest point
        setHeightVh((current) => getClosestSnapPoint(current));
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
    [heightVh, minHeightVh, maxHeightVh, getClosestSnapPoint]
  );

  // Toggle between minimized and half height
  const toggleHeight = useCallback(() => {
    if (isMinimized || heightVh === minHeightVh) {
      setHeightVh(50);
      setIsMinimized(false);
    } else {
      setHeightVh(minHeightVh);
      setIsMinimized(true);
    }
  }, [isMinimized, heightVh, minHeightVh]);

  // Maximize drawer
  const maximize = useCallback(() => {
    setHeightVh(maxHeightVh);
    setIsMinimized(false);
  }, [maxHeightVh]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            style={{ height: `${heightVh}vh` }}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-card rounded-t-xl shadow-2xl',
              'flex flex-col overflow-hidden',
              'border-t border-border/50',
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-panel-title"
          >
            {/* Drag handle */}
            <button
              type="button"
              className="flex justify-center w-full py-2 cursor-grab active:cursor-grabbing shrink-0 bg-transparent border-0"
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
              aria-label="Resize drawer"
            >
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
            </button>

            {/* Header */}
            {headerContent || (
              <div className="flex items-center justify-between px-4 pb-3 border-b shrink-0">
                <h2
                  id="drawer-panel-title"
                  className="font-semibold text-foreground"
                >
                  {title}
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleHeight}
                    className="h-8 w-8"
                    aria-label={isMinimized ? 'Expand drawer' : 'Minimize drawer'}
                  >
                    {isMinimized || heightVh <= minHeightVh ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  {heightVh < maxHeightVh && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={maximize}
                      className="h-8 w-8"
                      aria-label="Maximize drawer"
                    >
                      <GripHorizontal className="h-4 w-4 rotate-90" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8"
                    aria-label="Close drawer"
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
      )}
    </AnimatePresence>
  );
}
