'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Send,
  BookOpen,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLiteratureStore } from '@/stores/literature.store';
import { LiteratureSourceBadge } from './LiteratureSourceBadge';
import { CitationCard } from './CitationCard';
import type { Citation, ConfidenceLevel } from '@/domains/literature';

interface LiteratureChatPanelProps {
  /** Current letter ID for context */
  letterId?: string;
  /** Selected text excerpt for context-aware search */
  selectedText?: string;
  /** Callback when citation is inserted into letter */
  onInsertCitation?: (citation: Citation) => void;
}

/**
 * Clinical Literature Chat Panel.
 *
 * Provides a conversational interface for searching clinical literature
 * across UpToDate, PubMed, and user's personal library.
 */
export function LiteratureChatPanel({
  letterId,
  selectedText,
  onInsertCitation,
}: LiteratureChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const {
    isOpen,
    layout,
    messages,
    isSearching,
    error,
    activeSources,
    selectedCitation,
    queriesThisMonth,
    queryLimit,
    closePanel,
    addMessage,
    setSearching,
    setError,
    setLetterContext,
    selectCitation,
    incrementQueryCount,
    toggleSource,
  } = useLiteratureStore();

  // Set context when letter changes
  useEffect(() => {
    if (letterId || selectedText) {
      setLetterContext(letterId || null, selectedText || null);
    }
  }, [letterId, selectedText, setLetterContext]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle search submission
  const handleSearch = useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || isSearching) return;

    // Check if at limit
    if (queriesThisMonth >= queryLimit) {
      setError('Monthly query limit reached. Upgrade your plan for more queries.');
      return;
    }

    // Add user message
    addMessage({
      role: 'user',
      content: trimmedQuery,
    });
    setQuery('');
    setSearching(true);
    setError(null);

    try {
      const response = await fetch('/api/literature/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedQuery,
          context: selectedText,
          letterId,
          sources: activeSources,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Search failed');
      }

      const { result } = await response.json();

      // Add assistant message
      addMessage({
        role: 'assistant',
        content: result.answer,
        citations: result.citations,
        confidence: result.confidence,
        responseTimeMs: result.responseTimeMs,
      });

      incrementQueryCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [
    query,
    isSearching,
    queriesThisMonth,
    queryLimit,
    selectedText,
    letterId,
    activeSources,
    addMessage,
    setSearching,
    setError,
    incrementQueryCount,
  ]);

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // Handle citation selection
  const handleCitationClick = (citation: Citation) => {
    selectCitation(citation);
  };

  // Handle citation insertion
  const handleInsertCitation = () => {
    if (selectedCitation && onInsertCitation) {
      onInsertCitation(selectedCitation);
      selectCitation(null);
    }
  };

  // Panel animations based on layout
  const panelVariants = {
    side: {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
    },
    popup: {
      initial: { opacity: 0, scale: 0.95, y: 20 },
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.95, y: 20 },
    },
    drawer: {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
    },
  };

  // Panel positioning based on layout
  const panelClasses = cn(
    'bg-card shadow-lg z-50 flex flex-col',
    layout === 'side' && 'fixed top-0 right-0 h-full w-full sm:w-[400px] md:w-[480px]',
    layout === 'popup' && 'fixed bottom-4 right-4 w-[360px] h-[500px] rounded-lg',
    layout === 'drawer' && 'fixed bottom-0 left-0 right-0 h-[60vh] rounded-t-lg'
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for side and drawer layouts */}
          {(layout === 'side' || layout === 'drawer') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={closePanel}
            />
          )}

          {/* Panel */}
          <motion.div
            initial={panelVariants[layout].initial}
            animate={panelVariants[layout].animate}
            exit={panelVariants[layout].exit}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={panelClasses}
            role="dialog"
            aria-modal="true"
            aria-labelledby="literature-panel-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h2 id="literature-panel-title" className="font-semibold">
                  Clinical Literature
                </h2>
                {queriesThisMonth > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {queriesThisMonth}/{queryLimit}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closePanel}
                  className="h-8 w-8"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Source filters */}
            <div className="flex items-center gap-2 p-3 border-b bg-muted/50">
              <span className="text-xs text-muted-foreground">Sources:</span>
              <div className="flex gap-1.5">
                <LiteratureSourceBadge
                  source="uptodate"
                  active={activeSources.includes('uptodate')}
                  onClick={() => toggleSource('uptodate')}
                />
                <LiteratureSourceBadge
                  source="pubmed"
                  active={activeSources.includes('pubmed')}
                  onClick={() => toggleSource('pubmed')}
                />
                <LiteratureSourceBadge
                  source="user_library"
                  active={activeSources.includes('user_library')}
                  onClick={() => toggleSource('user_library')}
                />
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      Ask clinical questions about diagnoses, treatments, medications, or guidelines.
                    </p>
                    {selectedText && (
                      <p className="text-primary text-xs mt-2">
                        Context: &ldquo;{selectedText.substring(0, 100)}...&rdquo;
                      </p>
                    )}
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex flex-col gap-2',
                      message.role === 'user' ? 'items-end' : 'items-start'
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-lg px-3 py-2 max-w-[90%]',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>

                    {/* Citations */}
                    {message.citations && message.citations.length > 0 && (
                      <div className="flex flex-col gap-1.5 w-full max-w-[90%]">
                        <span className="text-xs text-muted-foreground">
                          {message.citations.length} source{message.citations.length > 1 ? 's' : ''}
                        </span>
                        {message.citations.map((citation, idx) => (
                          <CitationCard
                            key={`${citation.source}-${idx}`}
                            citation={citation}
                            isSelected={selectedCitation === citation}
                            onClick={() => handleCitationClick(citation)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Confidence indicator */}
                    {message.confidence && (
                      <ConfidenceIndicator level={message.confidence} />
                    )}
                  </div>
                ))}

                {/* Loading indicator */}
                {isSearching && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Searching literature...</span>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-3">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Selected citation actions */}
            {selectedCitation && onInsertCitation && (
              <div className="p-3 border-t bg-primary/5">
                <Button
                  onClick={handleInsertCitation}
                  className="w-full"
                  size="sm"
                >
                  Insert Citation into Letter
                </Button>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask a clinical question..."
                  disabled={isSearching}
                  className="flex-1"
                />
                <Button
                  onClick={handleSearch}
                  disabled={!query.trim() || isSearching}
                  size="icon"
                  aria-label="Search"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Confidence level indicator.
 */
function ConfidenceIndicator({ level }: { level: ConfidenceLevel }) {
  const colors = {
    high: 'text-green-600 bg-green-100',
    medium: 'text-amber-600 bg-amber-100',
    low: 'text-red-600 bg-red-100',
  };

  const labels = {
    high: 'High confidence',
    medium: 'Medium confidence',
    low: 'Limited evidence',
  };

  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full', colors[level])}>
      {labels[level]}
    </span>
  );
}
