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
import { X, ChevronDown, ChevronUp, Search, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  drawerVariants,
  overlayVariants,
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
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'fixed inset-0 z-40',
              'bg-clinical-gray-950/30 backdrop-blur-sm'
            )}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            style={{ height: `${heightVh}vh` }}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-card rounded-t-2xl',
              'flex flex-col overflow-hidden',
              'border-t border-clinical-gray-200',
              'shadow-elevated',
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-panel-title"
          >
            {/* Drag handle - polished pill */}
            <button
              type="button"
              className={cn(
                'flex justify-center w-full py-3 shrink-0',
                'cursor-grab active:cursor-grabbing',
                'bg-transparent border-0',
                'touch-manipulation'
              )}
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
              aria-label="Resize drawer"
            >
              <div className={cn(
                'w-10 h-1 rounded-full',
                'bg-clinical-gray-300',
                'transition-colors duration-150',
                'hover:bg-clinical-gray-400'
              )} />
            </button>

            {/* Header */}
            {headerContent || (
              <header className={cn(
                'flex items-center justify-between px-5 pb-4',
                'border-b border-clinical-gray-200 shrink-0'
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
                    id="drawer-panel-title"
                    className="text-lg font-semibold text-clinical-gray-900 tracking-tight font-ui-sans"
                  >
                    {title}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleHeight}
                    className={cn(
                      'h-8 w-8 rounded-lg',
                      'hover:bg-clinical-gray-100 active:bg-clinical-gray-200',
                      'transition-colors duration-150'
                    )}
                    aria-label={isMinimized ? 'Expand drawer' : 'Minimize drawer'}
                  >
                    {isMinimized || heightVh <= minHeightVh ? (
                      <ChevronUp className="h-4 w-4 text-clinical-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-clinical-gray-500" />
                    )}
                  </Button>
                  {heightVh < maxHeightVh && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={maximize}
                      className={cn(
                        'h-8 w-8 rounded-lg',
                        'hover:bg-clinical-gray-100 active:bg-clinical-gray-200',
                        'transition-colors duration-150'
                      )}
                      aria-label="Maximize drawer"
                    >
                      <Maximize2 className="h-4 w-4 text-clinical-gray-500" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className={cn(
                      'h-8 w-8 rounded-lg',
                      'hover:bg-clinical-gray-100 active:bg-clinical-gray-200',
                      'transition-colors duration-150 group'
                    )}
                    aria-label="Close drawer"
                  >
                    <X className="h-4 w-4 text-clinical-gray-500 group-hover:text-clinical-gray-700" />
                  </Button>
                </div>
              </header>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
