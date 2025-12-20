// src/components/documents/DocumentSelector.tsx
// Document selection UI for letter creation

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Search, FileText, Image as ImageIcon, Check, X, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentData } from './DocumentPreview';

interface DocumentSelectorProps {
  documents: DocumentData[];
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  maxSelections?: number | undefined;
  requiredTypes?: Array<'pdf' | 'image'> | undefined;
  showExtractedData?: boolean | undefined;
  className?: string | undefined;
}

export function DocumentSelector({
  documents,
  selectedIds,
  onSelectionChange,
  maxSelections,
  requiredTypes,
  showExtractedData = true,
  className,
}: DocumentSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pdf' | 'image'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter documents - only show processed ones that match filters
  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => doc.status === 'processed')
      .filter((doc) => {
        if (typeFilter !== 'all' && doc.type !== typeFilter) return false;
        if (searchTerm && !doc.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (requiredTypes && !requiredTypes.includes(doc.type)) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [documents, typeFilter, searchTerm, requiredTypes]);

  const handleToggle = useCallback(
    (doc: DocumentData) => {
      const newSelection = new Set(selectedIds);

      if (newSelection.has(doc.id)) {
        newSelection.delete(doc.id);
      } else {
        if (maxSelections && newSelection.size >= maxSelections) {
          // Don't add more if at max
          return;
        }
        newSelection.add(doc.id);
      }

      onSelectionChange(newSelection);
    },
    [selectedIds, onSelectionChange, maxSelections]
  );

  const handleClearAll = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  const handleSelectAll = useCallback(() => {
    const allIds = new Set(
      filteredDocuments
        .slice(0, maxSelections ?? filteredDocuments.length)
        .map((d) => d.id)
    );
    onSelectionChange(allIds);
  }, [filteredDocuments, maxSelections, onSelectionChange]);

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const getTypeLabel = (doc: DocumentData): string => {
    const extractedType = doc.extractedData?.type;
    if (extractedType) {
      switch (extractedType) {
        case 'ECHO_REPORT':
          return 'Echo Report';
        case 'ANGIOGRAM_REPORT':
          return 'Angiogram';
        case 'LAB_RESULT':
          return 'Lab Results';
        case 'REFERRAL':
          return 'Referral';
        default:
          return 'Document';
      }
    }
    return doc.type === 'pdf' ? 'PDF' : 'Image';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Select Documents</h3>
          <p className="text-xs text-muted-foreground">
            {selectedIds.size} selected
            {maxSelections && ` (max ${maxSelections})`}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
          {filteredDocuments.length > 0 && selectedIds.size < (maxSelections ?? filteredDocuments.length) && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-primary hover:text-primary/80"
            >
              Select All
            </button>
          )}
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1'
            )}
          />
        </div>
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'pdf' | 'image')}
            className={cn(
              'appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1'
            )}
          >
            <option value="all">All Types</option>
            <option value="pdf">PDF Only</option>
            <option value="image">Images Only</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Document list */}
      <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No processed documents available</p>
          </div>
        ) : (
          filteredDocuments.map((doc) => {
            const isSelected = selectedIds.has(doc.id);
            const isExpanded = expandedId === doc.id;

            return (
              <div
                key={doc.id}
                className={cn(
                  'rounded-lg border transition-colors',
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'
                )}
              >
                {/* Main row */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggle(doc)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToggle(doc);
                    }
                  }}
                  className="flex items-center gap-3 p-3 cursor-pointer"
                >
                  {/* Selection indicator */}
                  <div
                    className={cn(
                      'flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center',
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border'
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>

                  {/* File icon */}
                  {doc.type === 'pdf' ? (
                    <FileText className="h-6 w-6 text-red-500 shrink-0" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-blue-500 shrink-0" />
                  )}

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getTypeLabel(doc)} · {formatDate(doc.createdAt)}
                    </p>
                  </div>

                  {/* Expand button for extracted data */}
                  {showExtractedData && doc.extractedData && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : doc.id);
                      }}
                      className="p-1 rounded hover:bg-muted"
                      aria-label={isExpanded ? 'Hide details' : 'Show details'}
                    >
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Expanded extracted data preview */}
                {isExpanded && doc.extractedData && (
                  <div className="px-3 pb-3 pt-0 border-t border-border">
                    <ExtractedDataPreview data={doc.extractedData} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Preview of extracted data for selection context
interface ExtractedDataPreviewProps {
  data: Record<string, unknown>;
}

function ExtractedDataPreview({ data }: ExtractedDataPreviewProps) {
  const type = data.type as string;

  const getKeyValues = (): Array<{ label: string; value: string }> => {
    const values: Array<{ label: string; value: string }> = [];

    switch (type) {
      case 'ECHO_REPORT': {
        const echoData = data as Record<string, unknown>;
        if (echoData.lvef !== undefined) {
          values.push({ label: 'LVEF', value: `${echoData.lvef}%` });
        }
        if (echoData.tapse !== undefined) {
          values.push({ label: 'TAPSE', value: `${echoData.tapse}mm` });
        }
        const aorticValve = echoData.aorticValve as Record<string, unknown> | undefined;
        if (aorticValve?.stenosisSeverity) {
          values.push({ label: 'Aortic Stenosis', value: String(aorticValve.stenosisSeverity) });
        }
        const mitralValve = echoData.mitralValve as Record<string, unknown> | undefined;
        if (mitralValve?.regurgitationSeverity) {
          values.push({ label: 'Mitral Regurg.', value: String(mitralValve.regurgitationSeverity) });
        }
        break;
      }
      case 'ANGIOGRAM_REPORT': {
        const angioData = data as Record<string, unknown>;
        const vessels = ['lmca', 'lad', 'lcx', 'rca'] as const;
        for (const vessel of vessels) {
          const vesselData = angioData[vessel] as Record<string, unknown> | undefined;
          if (vesselData?.stenosis !== undefined && Number(vesselData.stenosis) > 0) {
            values.push({
              label: vessel.toUpperCase(),
              value: `${vesselData.stenosis}% stenosis`,
            });
          }
        }
        if (angioData.pciPerformed) {
          values.push({ label: 'PCI', value: 'Performed' });
        }
        break;
      }
      case 'LAB_RESULT': {
        const labData = data as Record<string, unknown>;
        const labTests = ['troponin', 'bnp', 'creatinine', 'potassium'] as const;
        for (const test of labTests) {
          const testData = labData[test] as Record<string, unknown> | undefined;
          if (testData?.value !== undefined) {
            values.push({
              label: test.charAt(0).toUpperCase() + test.slice(1),
              value: `${testData.value} ${testData.unit ?? ''}`.trim(),
            });
          }
        }
        break;
      }
      default: {
        const genericData = data as Record<string, unknown>;
        if (genericData.summary) {
          values.push({ label: 'Summary', value: String(genericData.summary).slice(0, 100) + '...' });
        }
        break;
      }
    }

    return values.slice(0, 4); // Limit to 4 key values
  };

  const keyValues = getKeyValues();

  if (keyValues.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">No extracted data available</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 py-2">
      {keyValues.map(({ label, value }) => (
        <div key={label} className="text-xs">
          <span className="text-muted-foreground">{label}:</span>{' '}
          <span className="font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}

export type { DocumentSelectorProps };
