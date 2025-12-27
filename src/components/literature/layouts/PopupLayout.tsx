'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  overlayVariants,
  popupVariants,
} from '@/styles/clinical-animations';

interface PopupLayoutProps {
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
  /** Width of popup (default: 640px) */
  width?: number | string;
  /** Maximum height as viewport percentage (default: 80) */
  maxHeightVh?: number;
  /** Show close button in header */
  showCloseButton?: boolean;
  /** Additional class names for panel */
  className?: string;
}

/**
 * Popup layout for clinical literature chat.
 *
 * Features:
 * - Centered modal overlay
 * - Click outside to close
 * - Escape key to close
 * - Smooth scale/fade animation
 * - Auto-focus trap
 */
export function PopupLayout({
  children,
  isOpen,
  onClose,
  title = 'Clinical Assistant',
  headerContent,
  width = 640,
  maxHeightVh = 80,
  showCloseButton = true,
  className,
}: PopupLayoutProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Store the previously focused element
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
    }
  }, [isOpen]);

  // Focus first focusable element when opened
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const focusableElements = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0] as HTMLElement | undefined;
      firstFocusable?.focus();
    }
  }, [isOpen]);

  // Restore focus when closed
  useEffect(() => {
    if (!isOpen && previousActiveElement.current) {
      (previousActiveElement.current as HTMLElement).focus?.();
    }
  }, [isOpen]);

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

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Trap focus within the popup
  const handleTabKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusableElements = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0] as HTMLElement | undefined;
      const lastFocusable = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement | undefined;

      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    },
    []
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with refined blur */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'fixed inset-0 z-50',
              'bg-clinical-gray-950/40 backdrop-blur-md'
            )}
            onClick={handleBackdropClick}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            variants={popupVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              width: typeof width === 'number' ? `${width}px` : width,
              maxHeight: `${maxHeightVh}vh`,
            }}
            className={cn(
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'bg-card rounded-2xl z-50',
              'flex flex-col overflow-hidden',
              'border border-clinical-gray-200',
              'shadow-elevated',
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="popup-panel-title"
            onKeyDown={handleTabKey}
          >
            {/* Header */}
            {headerContent || (
              <header className={cn(
                'flex items-center justify-between px-6 py-5',
                'bg-clinical-gray-50 border-b border-clinical-gray-200',
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
                    id="popup-panel-title"
                    className="text-lg font-semibold text-clinical-gray-900 tracking-tight font-ui-sans"
                  >
                    {title}
                  </h2>
                </div>
                {showCloseButton && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className={cn(
                      'h-8 w-8 rounded-lg',
                      'hover:bg-clinical-gray-200 active:bg-clinical-gray-300',
                      'transition-colors duration-150 group'
                    )}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5 text-clinical-gray-500 group-hover:text-clinical-gray-700" />
                  </Button>
                )}
              </header>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-card">{children}</div>

            {/* Keyboard hint */}
            <footer className={cn(
              'px-6 py-3 border-t border-clinical-gray-200',
              'bg-clinical-gray-50 shrink-0'
            )}>
              <p className="text-xs text-clinical-gray-500 text-center font-ui-sans">
                Press{' '}
                <kbd className={cn(
                  'px-2 py-1 rounded-md text-xs font-clinical-mono font-medium',
                  'bg-white border border-clinical-gray-300',
                  'text-clinical-gray-600',
                  'shadow-sm'
                )}>
                  Esc
                </kbd>
                {' '}to close
              </p>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
