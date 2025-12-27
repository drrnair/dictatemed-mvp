'use client';

import { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Settings, AlertCircle, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useLiteratureStore } from '@/stores/literature.store';
import { useLiteratureSearch, useLiteratureKeyboardShortcuts } from '@/hooks/useLiteratureSearch';
import { SidePanelLayout } from './layouts/SidePanelLayout';
import { PopupLayout } from './layouts/PopupLayout';
import { DrawerLayout } from './layouts/DrawerLayout';
import { LiteratureSearchInput } from './LiteratureSearchInput';
import { LiteratureSearchResults } from './LiteratureSearchResults';
import { LiteratureSourceBadge } from './LiteratureSourceBadge';
import { LayoutToggle } from './LayoutToggle';
import { CitationCard } from './CitationCard';
import { ClinicalLoadingState } from './ClinicalLoadingState';
import { ClinicalEmptyState } from './ClinicalEmptyState';
import { ConfidenceBadge } from './ConfidenceBadge';
import {
  staggerContainerVariants,
  staggerChildVariants,
  cardVariants,
  buttonHoverEffect,
} from '@/styles/clinical-animations';
import type { Citation, ConfidenceLevel } from '@/domains/literature';

interface ClinicalAssistantPanelProps {
  /** Current letter ID for context */
  letterId?: string;
  /** Selected text excerpt for context-aware search */
  selectedText?: string;
  /** Callback when citation is inserted into letter */
  onInsertCitation?: (citation: Citation) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Clinical Assistant Panel - Main wrapper component.
 *
 * Renders the appropriate layout (side, popup, or drawer) based on user
 * preference and provides the clinical literature chat interface.
 *
 * Features:
 * - Three layout modes: side panel, popup modal, bottom drawer
 * - Keyboard shortcuts: Cmd+K (toggle popup), Escape (close)
 * - Context-aware search based on selected text
 * - Multi-source search (UpToDate, PubMed, User Library)
 * - Citation insertion into letters
 */
export function ClinicalAssistantPanel({
  letterId,
  selectedText,
  onInsertCitation,
  className,
}: ClinicalAssistantPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Store state
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
    setLetterContext,
    selectCitation,
    toggleSource,
  } = useLiteratureStore();

  // Search hook
  const {
    query,
    setQuery,
    search,
    result,
  } = useLiteratureSearch({ letterId });

  // Keyboard shortcuts
  useLiteratureKeyboardShortcuts();

  // Update context when letter/selection changes
  useEffect(() => {
    if (letterId || selectedText) {
      setLetterContext(letterId || null, selectedText || null);
    }
  }, [letterId, selectedText, setLetterContext]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle search submission
  const handleSearch = useCallback(async () => {
    if (!query.trim() || isSearching) return;
    await search(query, selectedText);
  }, [query, isSearching, search, selectedText]);

  // Handle citation click
  const handleCitationClick = useCallback(
    (citation: Citation) => {
      selectCitation(citation);
    },
    [selectCitation]
  );

  // Handle citation insertion
  const handleInsertCitation = useCallback(
    (citation: Citation) => {
      if (onInsertCitation) {
        onInsertCitation(citation);
        selectCitation(null);
      }
    },
    [onInsertCitation, selectCitation]
  );

  // Panel header content with clinical styling
  const headerContent = (
    <div className="flex flex-col gap-3 p-4 border-b border-clinical-gray-200 shrink-0 bg-white">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Icon badge */}
          <div className="w-9 h-9 rounded-xl bg-clinical-blue-100 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-clinical-blue-600" strokeWidth={2} />
          </div>
          <div>
            <h2 className="font-semibold text-clinical-gray-900 font-ui-sans">
              Clinical Literature
            </h2>
            {queriesThisMonth > 0 && (
              <p className="text-xs text-clinical-gray-500 font-clinical-mono">
                {queriesThisMonth}/{queryLimit} queries
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <LayoutToggle compact />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-clinical-gray-500 hover:text-clinical-gray-700 hover:bg-clinical-gray-100"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Source filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-clinical-gray-500 font-medium">Sources:</span>
        <div className="flex gap-1.5 flex-wrap">
          <LiteratureSourceBadge
            source="uptodate"
            active={activeSources.includes('uptodate')}
            onClick={() => toggleSource('uptodate')}
            showLabel={false}
          />
          <LiteratureSourceBadge
            source="pubmed"
            active={activeSources.includes('pubmed')}
            onClick={() => toggleSource('pubmed')}
            showLabel={false}
          />
          <LiteratureSourceBadge
            source="user_library"
            active={activeSources.includes('user_library')}
            onClick={() => toggleSource('user_library')}
            showLabel={false}
          />
        </div>
      </div>
    </div>
  );

  // Panel content with clinical polish
  const panelContent = (
    <div className="flex flex-col h-full bg-clinical-gray-50">
      {headerContent}

      {/* Messages area */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Empty state - use ClinicalEmptyState */}
          {messages.length === 0 && !result && !isSearching && (
            <ClinicalEmptyState
              variant="search"
              selectedText={selectedText}
            />
          )}

          {/* Chat messages with staggered animation */}
          {messages.length > 0 && (
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  variants={staggerChildVariants}
                  className={cn(
                    'flex flex-col gap-2',
                    message.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-xl px-4 py-3 max-w-[90%] shadow-sm',
                      message.role === 'user'
                        ? 'bg-clinical-blue-600 text-white'
                        : 'bg-white border border-clinical-gray-200'
                    )}
                  >
                    <p className={cn(
                      'text-sm whitespace-pre-wrap font-ui-sans',
                      message.role === 'assistant' && 'text-clinical-gray-800'
                    )}>
                      {message.content}
                    </p>
                  </div>

                  {/* Citations */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="flex flex-col gap-1.5 w-full max-w-[90%]">
                      <span className="text-xs text-clinical-gray-500 font-medium">
                        {message.citations.length} source
                        {message.citations.length > 1 ? 's' : ''}
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

                  {/* Confidence indicator - use ConfidenceBadge */}
                  {message.confidence && (
                    <ConfidenceBadge level={message.confidence} compact />
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Current search result (if using result state) */}
          {result && !isSearching && (
            <LiteratureSearchResults
              result={result}
              selectedCitation={selectedCitation}
              onCitationClick={handleCitationClick}
              onInsertCitation={onInsertCitation ? handleInsertCitation : undefined}
            />
          )}

          {/* Loading indicator - use ClinicalLoadingState */}
          {isSearching && (
            <ClinicalLoadingState />
          )}

          {/* Error message with clinical styling */}
          {error && (
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="flex items-start gap-3 bg-critical-50 border border-critical-200 rounded-xl p-4"
            >
              <div className="w-8 h-8 rounded-lg bg-critical-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-4 w-4 text-critical-600" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-medium text-critical-800 font-ui-sans">
                  Search Error
                </p>
                <p className="text-sm text-critical-700 mt-0.5">{error}</p>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Selected citation actions */}
      {selectedCitation && onInsertCitation && (
        <div className="p-3 border-t bg-primary/5 shrink-0">
          <Button
            onClick={() => handleInsertCitation(selectedCitation)}
            className="w-full"
            size="sm"
          >
            Insert Citation into Letter
          </Button>
        </div>
      )}

      {/* Search input */}
      <div className="p-4 border-t shrink-0">
        <LiteratureSearchInput
          value={query}
          onChange={setQuery}
          onSubmit={handleSearch}
          isLoading={isSearching}
          selectedText={selectedText}
          placeholder="Ask a clinical question..."
        />
      </div>
    </div>
  );

  // Render appropriate layout
  if (layout === 'side') {
    return (
      <SidePanelLayout
        isOpen={isOpen}
        onClose={closePanel}
        title="Clinical Literature"
        headerContent={null}
        className={className}
      >
        {panelContent}
      </SidePanelLayout>
    );
  }

  if (layout === 'popup') {
    return (
      <PopupLayout
        isOpen={isOpen}
        onClose={closePanel}
        title="Clinical Literature"
        headerContent={null}
        showCloseButton={false}
        width={560}
        maxHeightVh={75}
        className={className}
      >
        {panelContent}
      </PopupLayout>
    );
  }

  // Drawer layout (default for mobile)
  return (
    <DrawerLayout
      isOpen={isOpen}
      onClose={closePanel}
      title="Clinical Literature"
      headerContent={null}
      initialHeightVh={50}
      minHeightVh={30}
      maxHeightVh={85}
      className={className}
    >
      {panelContent}
    </DrawerLayout>
  );
}

/**
 * Confidence level indicator component.
 */
function ConfidenceIndicator({ level }: { level: ConfidenceLevel }) {
  const colors = {
    high: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
    medium: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
    low: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
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
