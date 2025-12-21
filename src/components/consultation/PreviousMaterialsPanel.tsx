'use client';

// src/components/consultation/PreviousMaterialsPanel.tsx
// Panel for selecting previous letters and documents as context

import { useState, useEffect, useCallback } from 'react';
import { FileText, File, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MaterialItem } from '@/domains/consultation/consultation.types';

interface PreviousMaterialsPanelProps {
  consultationId?: string;
  patientId?: string;
  selectedLetterIds: string[];
  selectedDocumentIds: string[];
  onSelectionChange: (letterIds: string[], documentIds: string[]) => void;
  disabled?: boolean;
}

export function PreviousMaterialsPanel({
  consultationId,
  patientId,
  selectedLetterIds,
  selectedDocumentIds,
  onSelectionChange,
  disabled = false,
}: PreviousMaterialsPanelProps) {
  const [letters, setLetters] = useState<MaterialItem[]>([]);
  const [documents, setDocuments] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'letters' | 'documents' | null>('letters');

  const fetchMaterials = useCallback(async () => {
    // Need either consultationId or patientId
    if (!consultationId && !patientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use consultation endpoint if we have consultationId, otherwise use patient endpoint
      const url = consultationId
        ? `/api/consultations/${consultationId}/materials`
        : `/api/patients/${patientId}/materials`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch materials');

      const data = await response.json();
      setLetters(data.letters || []);
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [consultationId, patientId]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const toggleLetter = (id: string) => {
    const newIds = selectedLetterIds.includes(id)
      ? selectedLetterIds.filter((i) => i !== id)
      : [...selectedLetterIds, id];
    onSelectionChange(newIds, selectedDocumentIds);
  };

  const toggleDocument = (id: string) => {
    const newIds = selectedDocumentIds.includes(id)
      ? selectedDocumentIds.filter((i) => i !== id)
      : [...selectedDocumentIds, id];
    onSelectionChange(selectedLetterIds, newIds);
  };

  const selectAllLetters = () => {
    onSelectionChange(letters.map((l) => l.id), selectedDocumentIds);
  };

  const selectAllDocuments = () => {
    onSelectionChange(selectedLetterIds, documents.map((d) => d.id));
  };

  const clearAll = () => {
    onSelectionChange([], []);
  };

  const totalSelected = selectedLetterIds.length + selectedDocumentIds.length;
  const totalAvailable = letters.length + documents.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading previous materials...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
        <Button variant="link" size="sm" onClick={fetchMaterials} className="ml-2">
          Retry
        </Button>
      </div>
    );
  }

  if (totalAvailable === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No previous letters or documents found for this patient.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with selection summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {totalSelected > 0 ? (
            <>
              <span className="font-medium text-foreground">{totalSelected}</span> of {totalAvailable} items selected as context
            </>
          ) : (
            'Select previous materials to use as context'
          )}
        </div>
        {totalSelected > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={disabled}>
            Clear selection
          </Button>
        )}
      </div>

      {/* Letters Section */}
      {letters.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer py-3"
            onClick={() => setExpandedSection(expandedSection === 'letters' ? null : 'letters')}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Previous Letters
                <Badge variant="secondary" className="ml-2">
                  {selectedLetterIds.length}/{letters.length}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                {expandedSection === 'letters' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllLetters();
                    }}
                    disabled={disabled}
                  >
                    Select all
                  </Button>
                )}
                {expandedSection === 'letters' ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
          {expandedSection === 'letters' && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                {letters.map((letter) => (
                  <MaterialItemRow
                    key={letter.id}
                    item={letter}
                    selected={selectedLetterIds.includes(letter.id)}
                    onToggle={() => toggleLetter(letter.id)}
                    disabled={disabled}
                    icon={<FileText className="h-4 w-4" />}
                  />
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Documents Section */}
      {documents.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer py-3"
            onClick={() => setExpandedSection(expandedSection === 'documents' ? null : 'documents')}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <File className="h-4 w-4" />
                Previous Documents
                <Badge variant="secondary" className="ml-2">
                  {selectedDocumentIds.length}/{documents.length}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                {expandedSection === 'documents' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllDocuments();
                    }}
                    disabled={disabled}
                  >
                    Select all
                  </Button>
                )}
                {expandedSection === 'documents' ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
          {expandedSection === 'documents' && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                {documents.map((doc) => (
                  <MaterialItemRow
                    key={doc.id}
                    item={doc}
                    selected={selectedDocumentIds.includes(doc.id)}
                    onToggle={() => toggleDocument(doc.id)}
                    disabled={disabled}
                    icon={<File className="h-4 w-4" />}
                  />
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

interface MaterialItemRowProps {
  item: MaterialItem;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
}

function MaterialItemRow({ item, selected, onToggle, disabled, icon }: MaterialItemRowProps) {
  const formattedDate = new Date(item.date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.name}</div>
        {item.description && (
          <div className="text-sm text-muted-foreground truncate">{item.description}</div>
        )}
      </div>
      <div className="text-sm text-muted-foreground whitespace-nowrap">{formattedDate}</div>
      {selected && <Check className="h-4 w-4 text-primary" />}
    </label>
  );
}
