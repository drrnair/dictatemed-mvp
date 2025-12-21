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
          'fixed inset-0 bg-black/20 transition-opacity z-40',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white dark:bg-gray-900 shadow-2xl z-50 transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-panel-title"
        data-testid="source-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <SourceIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h2
              id="source-panel-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
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
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100%-140px)]" data-testid="source-panel-content">
          <div className="p-6 space-y-6">
            {/* Source metadata */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FileIcon className="h-4 w-4" />
                <span className="font-medium">{sourceData.name}</span>
              </div>

              {sourceData.type === 'transcript' && (
                <>
                  {sourceData.metadata?.speaker && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <User className="h-4 w-4" />
                      <span>{sourceData.metadata.speaker}</span>
                    </div>
                  )}
                  {sourceData.metadata?.timestamp && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="h-4 w-4" />
                      <span>{sourceData.metadata.timestamp}</span>
                    </div>
                  )}
                </>
              )}

              {sourceData.type === 'document' && location.type === 'page' && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span>
                    Page {location.page}
                    {location.line && `, Line ${location.line}`}
                  </span>
                </div>
              )}

              {sourceData.metadata?.confidence !== undefined && (
                <div className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Confidence: </span>
                  <span
                    className={cn(
                      'font-medium',
                      sourceData.metadata.confidence >= 0.8
                        ? 'text-green-600 dark:text-green-400'
                        : sourceData.metadata.confidence >= 0.6
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {Math.round(sourceData.metadata.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* Source excerpt with highlighting */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Relevant Excerpt
              </h3>
              <div
                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm leading-relaxed"
                data-testid="source-excerpt"
              >
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {beforeHighlight.length > 100 && (
                    <span className="text-gray-500">... </span>
                  )}
                  {beforeHighlight.length > 100
                    ? beforeHighlight.substring(beforeHighlight.length - 100)
                    : beforeHighlight}
                  <mark
                    className="bg-yellow-200 dark:bg-yellow-600 text-gray-900 dark:text-gray-100 font-medium px-0.5 rounded"
                    data-testid="highlighted-text"
                  >
                    {highlightedText}
                  </mark>
                  {afterHighlight.substring(0, 100)}
                  {afterHighlight.length > 100 && (
                    <span className="text-gray-500"> ...</span>
                  )}
                </p>
              </div>
            </div>

            {/* Additional context */}
            {activeAnchor.excerpt && activeAnchor.excerpt !== highlightedText && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Reference
                </h3>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                    &ldquo;{activeAnchor.excerpt}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onViewFullSource(sourceData.id, sourceData.type)}
            aria-label={`View full ${sourceData.type}`}
            data-testid="view-full-source-button"
          >
            <FileText className="h-4 w-4 mr-2" />
            View Full {sourceData.type === 'transcript' ? 'Transcript' : 'Document'}
          </Button>
        </div>
      </div>
    </>
  );
}
