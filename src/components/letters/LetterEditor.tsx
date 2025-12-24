'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SourceAnchor {
  id: string;
  textStart: number;
  textEnd: number;
  sourceType: 'transcript' | 'document';
  sourceId: string;
  sourceLocation?: string;
  excerpt?: string;
}

interface LetterEditorProps {
  letterId: string;
  initialContent: string;
  sourceAnchors: SourceAnchor[];
  readOnly?: boolean;
  onContentChange: (content: string) => void;
  onSourceClick: (anchorId: string) => void;
  onSave: () => Promise<void>;
}

interface EditHistoryEntry {
  content: string;
  timestamp: number;
}

export function LetterEditor({
  letterId,
  initialContent,
  sourceAnchors,
  readOnly = false,
  onContentChange,
  onSourceClick,
  onSave,
}: LetterEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Edit history for undo/redo
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([
    { content: initialContent, timestamp: Date.now() },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const contentChangeTimeoutRef = useRef<NodeJS.Timeout>();

  // Calculate reading stats
  const characterCount = content.length;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 words per minute

  // Apply source anchor highlights to content
  const getHighlightedContent = useCallback(() => {
    if (!sourceAnchors.length) return content;

    // Sort anchors by start position (descending) to avoid offset issues
    const sortedAnchors = [...sourceAnchors].sort((a, b) => b.textStart - a.textStart);

    let highlightedContent = content;

    sortedAnchors.forEach((anchor) => {
      if (anchor.textStart >= 0 && anchor.textEnd <= content.length) {
        const beforeText = highlightedContent.substring(0, anchor.textStart);
        const anchorText = highlightedContent.substring(anchor.textStart, anchor.textEnd);
        const afterText = highlightedContent.substring(anchor.textEnd);

        // Use design system colors - primary/10 for transcript, clinical-verified/10 for documents
        const highlightClass = anchor.sourceType === 'transcript'
          ? 'bg-primary/15 hover:bg-primary/25'
          : 'bg-clinical-verified/15 hover:bg-clinical-verified/25';

        highlightedContent =
          beforeText +
          `<span class="${highlightClass} cursor-pointer rounded px-0.5 transition-colors duration-150" data-anchor-id="${anchor.id}" data-source-type="${anchor.sourceType}">${anchorText}</span>` +
          afterText;
      }
    });

    return highlightedContent;
  }, [content, sourceAnchors]);

  // Handle content edits
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.textContent || '';
    setContent(newContent);

    // Debounce content change callback
    if (contentChangeTimeoutRef.current) {
      clearTimeout(contentChangeTimeoutRef.current);
    }

    contentChangeTimeoutRef.current = setTimeout(() => {
      onContentChange(newContent);

      // Add to history
      setEditHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push({ content: newContent, timestamp: Date.now() });
        // Limit history to 100 entries
        if (newHistory.length > 100) {
          newHistory.shift();
          return newHistory;
        }
        return newHistory;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 99));
    }, 300);
  }, [historyIndex, onContentChange]);

  // Undo functionality
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const historyEntry = editHistory[newIndex];
      if (historyEntry) {
        const previousContent = historyEntry.content;
        setContent(previousContent);
        onContentChange(previousContent);

        if (editorRef.current) {
          editorRef.current.textContent = previousContent;
        }
      }
    }
  }, [historyIndex, editHistory, onContentChange]);

  // Redo functionality
  const handleRedo = useCallback(() => {
    if (historyIndex < editHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const historyEntry = editHistory[newIndex];
      if (historyEntry) {
        const nextContent = historyEntry.content;
        setContent(nextContent);
        onContentChange(nextContent);

        if (editorRef.current) {
          editorRef.current.textContent = nextContent;
        }
      }
    }
  }, [historyIndex, editHistory, onContentChange]);

  // Manual save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave();
      setLastSaved(new Date());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  // Auto-save functionality
  useEffect(() => {
    if (readOnly) return;

    autoSaveTimerRef.current = setInterval(async () => {
      setIsAutoSaving(true);
      try {
        await onSave();
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsAutoSaving(false);
      }
    }, 30000); // 30 seconds

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [readOnly, onSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      // Ctrl+Z or Cmd+Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Ctrl+Y or Cmd+Shift+Z to redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleUndo, handleRedo]);

  // Handle clicks on highlighted source anchors
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchorId = target.getAttribute('data-anchor-id');

      if (anchorId) {
        e.preventDefault();
        onSourceClick(anchorId);
      }
    };

    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('click', handleClick);
      return () => editor.removeEventListener('click', handleClick);
    }
    return undefined;
  }, [onSourceClick]);

  // Update editor content when initialContent changes
  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.textContent) {
      editorRef.current.innerHTML = getHighlightedContent();
    }
  }, [content, getHighlightedContent]);

  // Format last saved time
  const formatLastSaved = () => {
    if (!lastSaved) return null;

    const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div
      className="flex h-full flex-col"
      data-testid="letter-editor"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-card px-space-4 py-space-3 shadow-card">
        <div className="flex items-center gap-space-4">
          <div className="flex items-center gap-space-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex === 0 || readOnly}
              data-testid="undo-button"
              title="Undo (Ctrl+Z)"
              className="min-h-touch"
            >
              <span className="text-label">Undo</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedo}
              disabled={historyIndex === editHistory.length - 1 || readOnly}
              data-testid="redo-button"
              title="Redo (Ctrl+Y)"
              className="min-h-touch"
            >
              <span className="text-label">Redo</span>
            </Button>
          </div>

          {!readOnly && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              data-testid="save-button"
              title="Save (Ctrl+S)"
              className="min-h-touch gap-space-2"
            >
              {isSaving ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-space-4 text-body-sm text-muted-foreground">
          {/* Auto-save indicator */}
          {isAutoSaving && (
            <span
              className="flex items-center gap-space-1"
              data-testid="auto-save-indicator"
              role="status"
              aria-live="polite"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
              Auto-saving...
            </span>
          )}

          {/* Last saved */}
          {lastSaved && !isAutoSaving && (
            <span data-testid="last-saved" className="text-caption">
              Saved {formatLastSaved()}
            </span>
          )}

          {/* Error indicator */}
          {saveError && (
            <span
              className="text-caption text-clinical-critical"
              data-testid="save-error"
              role="alert"
            >
              Error: {saveError}
            </span>
          )}

          {/* Reading stats */}
          <div
            className="flex items-center gap-space-3 border-l border-border/60 pl-space-4"
            data-testid="reading-stats"
          >
            <span className="text-caption">{characterCount} characters</span>
            <span className="text-caption">{wordCount} words</span>
            <span className="text-caption">{estimatedReadingTime} min read</span>
          </div>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-auto bg-card">
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={handleInput}
          className={cn(
            'min-h-full p-space-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            'prose prose-lg max-w-4xl mx-auto',
            'dark:prose-invert',
            readOnly && 'cursor-default bg-muted/30',
            !readOnly && 'cursor-text'
          )}
          data-testid="editor-content"
          data-letter-id={letterId}
          spellCheck
          dangerouslySetInnerHTML={{ __html: getHighlightedContent() }}
          aria-label="Letter content editor"
        />
      </div>

      {/* Read-only indicator */}
      {readOnly && (
        <div
          className="border-t border-border/60 bg-muted/30 px-space-4 py-space-2 text-center text-body-sm text-muted-foreground"
          data-testid="readonly-indicator"
          role="status"
        >
          This letter has been approved and is read-only
        </div>
      )}
    </div>
  );
}
