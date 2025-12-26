'use client';

// src/components/referral/FastExtractionResult.tsx
// Displays patient identifiers extracted from documents with confidence indicators

import { useState } from 'react';
import {
  User,
  Calendar,
  Hash,
  CheckCircle2,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import type { FastExtractedData, FieldConfidence } from '@/domains/referrals';

/**
 * Props for the FastExtractionResult component.
 *
 * Note: The `onEdit` callback is called when the user saves an edited value.
 * The parent component must update the `data` prop for changes to reflect in the UI.
 */
export interface FastExtractionResultProps {
  /** Extracted patient data with confidence scores */
  data: FastExtractedData;
  /**
   * Callback when user edits a field. Called with field name and new value.
   * Parent must update `data` prop for changes to display.
   */
  onEdit?: (field: 'patientName' | 'dateOfBirth' | 'mrn', value: string) => void;
  /** Additional CSS classes to apply to the container */
  className?: string;
}

// Format date for display (YYYY-MM-DD to DD/MM/YYYY)
function formatDateForDisplay(dateStr: string | null): string {
  if (!dateStr) return '';
  // Handle both YYYY-MM-DD and DD/MM/YYYY formats
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

// Editable field with confidence indicator
function ExtractedField({
  icon: Icon,
  label,
  field,
  isEditing,
  editValue,
  onEditChange,
  onEditStart,
  onEditSave,
  onEditCancel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  field: FieldConfidence;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditStart: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}) {
  const hasValue = field.value !== null && field.value !== '';
  const displayValue = label === 'Date of Birth'
    ? formatDateForDisplay(field.value)
    : field.value;

  return (
    <div className="space-y-1.5" data-testid={`extracted-field-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Label>
        {hasValue && <ConfidenceIndicator confidence={field.confidence} size="sm" />}
      </div>

      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            className="h-9 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditSave();
              if (e.key === 'Escape') onEditCancel();
            }}
            data-testid="field-edit-input"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onEditSave}
            className="h-9 px-2"
            data-testid="field-save-button"
          >
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between group">
          <p
            className={cn(
              'text-sm font-medium',
              !hasValue && 'text-muted-foreground italic'
            )}
            data-testid="field-value"
          >
            {hasValue ? displayValue : 'Not found'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEditStart}
            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid="field-edit-button"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Edit {label}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export function FastExtractionResult({
  data,
  onEdit,
  className,
}: FastExtractionResultProps) {
  // Track which field is being edited
  const [editingField, setEditingField] = useState<'patientName' | 'dateOfBirth' | 'mrn' | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEditing = (field: 'patientName' | 'dateOfBirth' | 'mrn') => {
    setEditingField(field);
    setEditValue(data[field].value || '');
  };

  const saveEdit = () => {
    if (editingField && onEdit) {
      onEdit(editingField, editValue);
    }
    setEditingField(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Check if any field has low confidence
  const hasLowConfidence =
    data.patientName.level === 'low' ||
    data.dateOfBirth.level === 'low' ||
    data.mrn.level === 'low';

  // Check if we have any usable data
  const hasAnyData =
    data.patientName.value || data.dateOfBirth.value || data.mrn.value;

  return (
    <div
      className={cn('rounded-lg border p-4 space-y-4', className)}
      data-testid="fast-extraction-result"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <h3 className="text-sm font-medium">Patient Identified</h3>
        </div>
        <ConfidenceIndicator
          confidence={data.overallConfidence}
          showPercentage
          size="md"
        />
      </div>

      {/* Low confidence warning */}
      {hasLowConfidence && (
        <div
          className="flex items-start gap-2 p-2 rounded-md bg-amber-50 border border-amber-200"
          data-testid="low-confidence-warning"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Some fields have low confidence. Please verify the extracted information.
          </p>
        </div>
      )}

      {/* No data warning */}
      {!hasAnyData && (
        <div
          className="flex items-start gap-2 p-2 rounded-md bg-slate-50 border border-slate-200"
          data-testid="no-data-warning"
        >
          <AlertTriangle className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600">
            Could not extract patient identifiers from the documents. Please enter details manually.
          </p>
        </div>
      )}

      {/* Extracted fields */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ExtractedField
          icon={User}
          label="Patient Name"
          field={data.patientName}
          isEditing={editingField === 'patientName'}
          editValue={editValue}
          onEditChange={setEditValue}
          onEditStart={() => startEditing('patientName')}
          onEditSave={saveEdit}
          onEditCancel={cancelEdit}
        />
        <ExtractedField
          icon={Calendar}
          label="Date of Birth"
          field={data.dateOfBirth}
          isEditing={editingField === 'dateOfBirth'}
          editValue={editValue}
          onEditChange={setEditValue}
          onEditStart={() => startEditing('dateOfBirth')}
          onEditSave={saveEdit}
          onEditCancel={cancelEdit}
        />
        <ExtractedField
          icon={Hash}
          label="MRN/URN"
          field={data.mrn}
          isEditing={editingField === 'mrn'}
          editValue={editValue}
          onEditChange={setEditValue}
          onEditStart={() => startEditing('mrn')}
          onEditSave={saveEdit}
          onEditCancel={cancelEdit}
        />
      </div>

      {/* Processing time note */}
      <p className="text-xs text-muted-foreground">
        Extracted in {(data.processingTimeMs / 1000).toFixed(1)}s
      </p>
    </div>
  );
}
