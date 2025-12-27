'use client';

import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLiteratureStore } from '@/stores/literature.store';

interface LiteratureToolbarButtonProps {
  /** Currently selected text in the editor */
  selectedText?: string;
  className?: string;
}

/**
 * Toolbar button to open the literature chat panel.
 * Shows badge when there are unread messages.
 */
export function LiteratureToolbarButton({
  selectedText,
  className,
}: LiteratureToolbarButtonProps) {
  const { isOpen, messages, openPanel, closePanel, setLetterContext } =
    useLiteratureStore();

  const handleClick = () => {
    if (isOpen) {
      closePanel();
    } else {
      // Set context from selected text
      if (selectedText) {
        setLetterContext(null, selectedText);
      }
      openPanel();
    }
  };

  // Count unread assistant messages (messages since last user interaction)
  const lastUserMessageIndex = messages.findLastIndex((m) => m.role === 'user');
  const unreadCount =
    lastUserMessageIndex >= 0
      ? messages.slice(lastUserMessageIndex + 1).filter((m) => m.role === 'assistant').length
      : 0;

  return (
    <Button
      variant={isOpen ? 'secondary' : 'ghost'}
      size="sm"
      onClick={handleClick}
      className={cn('relative gap-1.5', className)}
      aria-label={isOpen ? 'Close literature panel' : 'Open literature panel'}
      aria-expanded={isOpen}
    >
      <BookOpen className="h-4 w-4" />
      <span className="hidden sm:inline">Literature</span>
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
        >
          {unreadCount}
        </Badge>
      )}
    </Button>
  );
}
