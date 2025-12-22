'use client';

import { useEffect } from 'react';
import { X, FileText, Mic, Clock, User, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface SourceAnchor {
  id: string;
  textStart: number;
  textEnd: number;
  sourceType: 'transcript' | 'document';
  sourceId: string;
  sourceLocation: string; // "timestamp:12:34" or "page:2,line:14"
  excerpt: string;
}

interface SourceData {
  type: 'transcript' | 'document';
  id: string;
  name: string;
  content: string;
  highlightStart: number;
  highlightEnd: number;
  metadata?: {
    speaker?: string;
    timestamp?: string;
    page?: number;
    confidence?: number;
  };
}

interface SourcePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeAnchor: SourceAnchor | null;
  sourceData: SourceData | null;
  onViewFullSource: (sourceId: string, sourceType: 'transcript' | 'document') => void;
}

export function SourcePanel({
  isOpen,
  onClose,
  activeAnchor,
  sourceData,
  onViewFullSource,
}: SourcePanelProps) {
  // Handle Escape key to close panel
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Don't render if not open or no data
  if (!activeAnchor || !sourceData) {
    return null;
  }

  // Parse location string for display
  const parseLocation = (location: string) => {
    if (location.startsWith('timestamp:')) {
      return { type: 'timestamp', value: location.replace('timestamp:', '') };
    }
    if (location.startsWith('page:')) {
      const parts = location.split(',');
      const page = parts[0]?.replace('page:', '');
      const line = parts[1]?.replace('line:', '');
      return { type: 'page', page, line };
    }
    return { type: 'unknown', value: location };
  };

  const location = parseLocation(activeAnchor.sourceLocation);

  // Split content into before, highlighted, and after sections
  const beforeHighlight = sourceData.content.substring(0, sourceData.highlightStart);
  const highlightedText = sourceData.content.substring(
    sourceData.highlightStart,
    sourceData.highlightEnd
  );
  const afterHighlight = sourceData.content.substring(sourceData.highlightEnd);

  // Get icon based on source type
  const SourceIcon = sourceData.type === 'transcript' ? Mic : FileText;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity z-40',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-[480px] bg-card shadow-md z-50 transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-panel-title"
        data-testid="source-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-space-4 border-b border-border/60">
          <div className="flex items-center gap-space-2">
            <SourceIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2
              id="source-panel-title"
              className="text-heading-2"
            >
              Source Material
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close source panel"
            data-testid="close-source-panel"
            className="min-w-touch min-h-touch"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100%-140px)]" data-testid="source-panel-content">
          <div className="p-space-6 space-y-space-6">
            {/* Source metadata */}
            <div className="space-y-space-3">
              <div className="flex items-center gap-space-2 text-body-sm text-muted-foreground">
                <FileIcon className="h-4 w-4" aria-hidden="true" />
                <span className="font-medium">{sourceData.name}</span>
              </div>

              {sourceData.type === 'transcript' && (
                <>
                  {sourceData.metadata?.speaker && (
                    <div className="flex items-center gap-space-2 text-body-sm text-muted-foreground">
                      <User className="h-4 w-4" aria-hidden="true" />
                      <span>{sourceData.metadata.speaker}</span>
                    </div>
                  )}
                  {sourceData.metadata?.timestamp && (
                    <div className="flex items-center gap-space-2 text-body-sm text-muted-foreground">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      <span>{sourceData.metadata.timestamp}</span>
                    </div>
                  )}
                </>
              )}

              {sourceData.type === 'document' && location.type === 'page' && (
                <div className="text-body-sm text-muted-foreground">
                  <span>
                    Page {location.page}
                    {location.line && `, Line ${location.line}`}
                  </span>
                </div>
              )}

              {sourceData.metadata?.confidence !== undefined && (
                <div className="text-body-sm">
                  <span className="text-muted-foreground">Confidence: </span>
                  <span
                    className={cn(
                      'font-medium',
                      sourceData.metadata.confidence >= 0.8
                        ? 'text-clinical-verified'
                        : sourceData.metadata.confidence >= 0.6
                        ? 'text-clinical-warning'
                        : 'text-clinical-critical'
                    )}
                  >
                    {Math.round(sourceData.metadata.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border/60" aria-hidden="true" />

            {/* Source excerpt with highlighting */}
            <div className="space-y-space-2">
              <h3 className="text-label font-semibold">
                Relevant Excerpt
              </h3>
              <div
                className="p-space-4 bg-muted/50 rounded-lg"
                data-testid="source-excerpt"
              >
                <p className="text-body-sm leading-relaxed whitespace-pre-wrap">
                  {beforeHighlight.length > 100 && (
                    <span className="text-muted-foreground">... </span>
                  )}
                  {beforeHighlight.length > 100
                    ? beforeHighlight.substring(beforeHighlight.length - 100)
                    : beforeHighlight}
                  <mark
                    className="bg-clinical-warning/30 font-medium px-0.5 rounded"
                    data-testid="highlighted-text"
                  >
                    {highlightedText}
                  </mark>
                  {afterHighlight.substring(0, 100)}
                  {afterHighlight.length > 100 && (
                    <span className="text-muted-foreground"> ...</span>
                  )}
                </p>
              </div>
            </div>

            {/* Additional context */}
            {activeAnchor.excerpt && activeAnchor.excerpt !== highlightedText && (
              <div className="space-y-space-2">
                <h3 className="text-label font-semibold">
                  Reference
                </h3>
                <div className="p-space-4 bg-primary/10 rounded-lg">
                  <p className="text-body-sm italic">
                    &ldquo;{activeAnchor.excerpt}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-space-4 border-t border-border/60 bg-card">
          <Button
            variant="outline"
            className="w-full min-h-touch gap-space-2"
            onClick={() => onViewFullSource(sourceData.id, sourceData.type)}
            aria-label={`View full ${sourceData.type}`}
            data-testid="view-full-source-button"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            View Full {sourceData.type === 'transcript' ? 'Transcript' : 'Document'}
          </Button>
        </div>
      </div>
    </>
  );
}
