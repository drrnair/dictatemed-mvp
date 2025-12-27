'use client';

import { motion } from 'framer-motion';
import { BookOpen, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLiteratureStore } from '@/stores/literature.store';
import { buttonHoverEffect } from '@/styles/clinical-animations';

interface LiteratureToolbarButtonProps {
  /** Currently selected text in the editor */
  selectedText?: string;
  className?: string;
}

/**
 * Toolbar button to open the literature chat panel.
 *
 * Features:
 * - Clinical blue accent when active
 * - Keyboard shortcut tooltip (Cmd+K)
 * - Unread message indicator
 * - Motion hover effect
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
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          whileHover={buttonHoverEffect.hover}
          whileTap={buttonHoverEffect.tap}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            className={cn(
              'relative gap-2 font-medium',
              'transition-colors duration-150',
              isOpen
                ? 'bg-clinical-blue-100 text-clinical-blue-700 hover:bg-clinical-blue-200'
                : 'text-clinical-gray-600 hover:text-clinical-gray-900 hover:bg-clinical-gray-100',
              className
            )}
            aria-label={isOpen ? 'Close literature panel' : 'Open literature panel'}
            aria-expanded={isOpen}
          >
            <BookOpen className={cn(
              'h-4 w-4',
              isOpen ? 'text-clinical-blue-600' : 'text-clinical-gray-500'
            )} />
            <span className="hidden sm:inline font-ui-sans">Literature</span>

            {/* Unread indicator */}
            {unreadCount > 0 && (
              <span className={cn(
                'absolute -top-1 -right-1 min-w-4 h-4 px-1',
                'flex items-center justify-center',
                'rounded-full text-[10px] font-bold',
                'bg-clinical-blue-600 text-white',
                'shadow-sm'
              )}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Clinical Literature</span>
          <kbd className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5',
            'bg-clinical-gray-100 border border-clinical-gray-300 rounded',
            'text-xs font-clinical-mono text-clinical-gray-600'
          )}>
            <Command className="w-3 h-3" />K
          </kbd>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
