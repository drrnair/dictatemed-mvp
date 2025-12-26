'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  /** Width of popup (default: 600px) */
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
  title = 'Clinical Literature',
  headerContent,
  width = 600,
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={handleBackdropClick}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              width: typeof width === 'number' ? `${width}px` : width,
              maxHeight: `${maxHeightVh}vh`,
            }}
            className={cn(
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'bg-card rounded-xl shadow-2xl z-50',
              'flex flex-col overflow-hidden',
              'border border-border/50',
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="popup-panel-title"
            onKeyDown={handleTabKey}
          >
            {/* Header */}
            {headerContent || (
              <div className="flex items-center justify-between p-4 border-b shrink-0">
                <h2
                  id="popup-panel-title"
                  className="font-semibold text-foreground"
                >
                  {title}
                </h2>
                {showCloseButton && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">{children}</div>

            {/* Keyboard hint */}
            <div className="px-4 py-2 border-t bg-muted/30 shrink-0">
              <p className="text-xs text-muted-foreground text-center">
                Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> to close
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
