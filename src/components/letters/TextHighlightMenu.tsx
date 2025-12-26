'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, BookOpen, ChevronDown, Pill, AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TextHighlightMenuProps {
  /** The currently selected text */
  selectedText: string;
  /** Position of the selection (viewport coordinates) */
  position: { x: number; y: number };
  /** Called when user wants to ask about the selection */
  onAsk: (selectedText: string) => void;
  /** Called when user wants to search for citations */
  onCite: (selectedText: string) => void;
  /** Called when user selects a quick action */
  onQuickAction?: (action: string, selectedText: string) => void;
  /** Called when menu should be dismissed */
  onDismiss: () => void;
  /** Whether the menu is visible */
  isVisible: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Quick action suggestions for clinical queries.
 */
const QUICK_ACTIONS = [
  { id: 'evidence', label: 'Evidence & guidelines', icon: FileText },
  { id: 'dosing', label: 'Dosing information', icon: Pill },
  { id: 'contraindications', label: 'Contraindications', icon: AlertTriangle },
  { id: 'interactions', label: 'Drug interactions', icon: Pill },
  { id: 'side-effects', label: 'Side effects', icon: AlertTriangle },
];

/**
 * Text Highlight Menu - Shows contextual actions when text is selected.
 *
 * Appears above the selected text in the letter editor, providing quick
 * access to clinical literature search and citation features.
 *
 * Features:
 * - "Ask" button to open literature search with context
 * - "Cite" button for quick citation search
 * - Quick action dropdown for common clinical queries
 * - Auto-hide after 5 seconds of inactivity
 * - Keyboard accessible
 */
export function TextHighlightMenu({
  selectedText,
  position,
  onAsk,
  onCite,
  onQuickAction,
  onDismiss,
  isVisible,
  className,
}: TextHighlightMenuProps) {
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Reset and restart auto-hide timer
  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onDismiss();
    }, 5000); // Auto-hide after 5 seconds
  }, [onDismiss]);

  // Start timer when menu becomes visible
  useEffect(() => {
    if (isVisible) {
      resetTimer();
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible, resetTimer]);

  // Pause timer when interacting with menu
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleMouseLeave = () => {
    resetTimer();
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onDismiss]);

  // Calculate menu position (above selection, centered)
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: position.y - 50,
    left: position.x,
    transform: 'translateX(-50%)',
    zIndex: 50,
  };

  // Handle actions
  const handleAsk = () => {
    onAsk(selectedText);
    onDismiss();
  };

  const handleCite = () => {
    onCite(selectedText);
    onDismiss();
  };

  const handleQuickAction = (actionId: string) => {
    if (onQuickAction) {
      onQuickAction(actionId, selectedText);
    } else {
      // Default: open ask with prefilled query
      onAsk(selectedText);
    }
    setIsQuickMenuOpen(false);
    onDismiss();
  };

  if (!isVisible || !selectedText) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className={cn(
        'animate-in fade-in-0 zoom-in-95 duration-150',
        'bg-card border border-border shadow-lg rounded-lg',
        'flex items-center gap-0.5 p-1',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="toolbar"
      aria-label="Text selection actions"
    >
      {/* Ask button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAsk}
        className="h-8 px-2.5 gap-1.5 text-sm font-medium"
        aria-label="Ask about selected text"
      >
        <MessageCircle className="h-4 w-4 text-primary" />
        <span>Ask</span>
      </Button>

      <div className="w-px h-5 bg-border" aria-hidden="true" />

      {/* Cite button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCite}
        className="h-8 px-2.5 gap-1.5 text-sm font-medium"
        aria-label="Find citations for selected text"
      >
        <BookOpen className="h-4 w-4 text-green-600" />
        <span>Cite</span>
      </Button>

      <div className="w-px h-5 bg-border" aria-hidden="true" />

      {/* Quick actions dropdown */}
      <DropdownMenu open={isQuickMenuOpen} onOpenChange={setIsQuickMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 gap-1 text-sm font-medium"
            aria-label="Quick clinical queries"
          >
            <span>Quick</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                className="gap-2 cursor-pointer"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{action.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Hook to manage text selection state in the letter editor.
 */
export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 2) {
      // Get the selection's bounding rectangle
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();

      if (rect) {
        setSelectedText(text);
        setSelectionPosition({
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
        setIsMenuVisible(true);
      }
    } else {
      // Don't immediately hide - let the menu handle its own visibility
      // This prevents flickering when clicking menu buttons
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedText('');
    setIsMenuVisible(false);
  }, []);

  // Listen for mouseup events on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = (e: MouseEvent) => {
      // Small delay to ensure selection is complete
      setTimeout(() => {
        handleTextSelection();
      }, 10);
    };

    // Clear selection when clicking outside
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is on the menu or inside it
      if (target.closest('[role="toolbar"]') || target.closest('[role="menu"]')) {
        return; // Don't clear if clicking menu
      }
      // Clear if clicking elsewhere
      if (isMenuVisible && !target.closest('[contenteditable]')) {
        clearSelection();
      }
    };

    container.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [containerRef, handleTextSelection, clearSelection, isMenuVisible]);

  return {
    selectedText,
    selectionPosition,
    isMenuVisible,
    setIsMenuVisible,
    clearSelection,
  };
}
