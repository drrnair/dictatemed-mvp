'use client';

// src/components/referral/ReferralFieldGroup.tsx
// Editable field group for extracted referral data sections

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Check, X, Edit2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ConfidenceIndicator } from './ConfidenceIndicator';

export interface FieldConfig {
  key: string;
  label: string;
  value?: string;
  type?: 'text' | 'date' | 'email' | 'tel';
  placeholder?: string;
}

export interface ReferralFieldGroupProps {
  title: string;
  icon: React.ReactNode;
  confidence: number;
  fields: FieldConfig[];
  onFieldChange: (key: string, value: string) => void;
  onAccept: () => void;
  onClear: () => void;
  onRestore?: () => void;
  isAccepted?: boolean;
  isCleared?: boolean;
  className?: string;
}

export function ReferralFieldGroup({
  title,
  icon,
  confidence,
  fields,
  onFieldChange,
  onAccept,
  onClear,
  onRestore,
  isAccepted = false,
  isCleared = false,
  className,
}: ReferralFieldGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Check if section has any meaningful data
  const hasData = fields.some((f) => f.value && f.value.trim() !== '');

  const handleFieldClick = useCallback((key: string) => {
    if (!isCleared) {
      setEditingField(key);
    }
  }, [isCleared]);

  const handleFieldBlur = useCallback(() => {
    setEditingField(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        setEditingField(null);
      } else if (e.key === 'Escape') {
        setEditingField(null);
      }
    },
    []
  );

  if (isCleared) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-muted-foreground/30 p-4',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="font-medium">{title}</span>
            <span className="text-sm">(cleared)</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestore ?? onAccept}
            className="text-xs"
          >
            Restore
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border',
        isAccepted ? 'border-green-200 bg-green-50/50' : 'border-border',
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between p-4 text-left"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{title}</span>
          {isAccepted && (
            <span className="text-xs text-green-600 font-medium">Accepted</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceIndicator confidence={confidence} showPercentage />
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t px-4 pb-4">
          {/* Fields */}
          <div className="mt-4 space-y-3">
            {fields.map((field) => (
              <div key={field.key} className="grid gap-1.5">
                <Label
                  htmlFor={`field-${field.key}`}
                  className="text-xs text-muted-foreground"
                >
                  {field.label}
                </Label>
                {editingField === field.key ? (
                  <Input
                    id={`field-${field.key}`}
                    type={field.type || 'text'}
                    value={field.value || ''}
                    onChange={(e) => onFieldChange(field.key, e.target.value)}
                    onBlur={handleFieldBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={field.placeholder}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional for click-to-edit pattern; user explicitly triggered edit mode
                    autoFocus
                    className="h-9"
                  />
                ) : (
                  <button
                    type="button"
                    className={cn(
                      'flex h-9 w-full items-center justify-between rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors',
                      'hover:border-input hover:bg-muted/50',
                      !field.value && 'text-muted-foreground italic'
                    )}
                    onClick={() => handleFieldClick(field.key)}
                  >
                    <span className="truncate">
                      {field.value || field.placeholder || 'Not provided'}
                    </span>
                    <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          {hasData && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant={isAccepted ? 'secondary' : 'outline'}
                size="sm"
                onClick={onAccept}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                {isAccepted ? 'Accepted' : 'Accept'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Specialized field group for referral context (with lists)
export interface ReferralContextFieldGroupProps {
  confidence: number;
  reasonForReferral?: string;
  keyProblems?: string[];
  investigationsMentioned?: string[];
  medicationsMentioned?: string[];
  urgency?: string;
  onReasonChange: (value: string) => void;
  onProblemsChange: (problems: string[]) => void;
  onAccept: () => void;
  onClear: () => void;
  onRestore?: () => void;
  isAccepted?: boolean;
  isCleared?: boolean;
  className?: string;
}

export function ReferralContextFieldGroup({
  confidence,
  reasonForReferral,
  keyProblems,
  investigationsMentioned,
  medicationsMentioned,
  urgency,
  onReasonChange,
  onProblemsChange,
  onAccept,
  onClear,
  onRestore,
  isAccepted = false,
  isCleared = false,
  className,
}: ReferralContextFieldGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditingReason, setIsEditingReason] = useState(false);

  const hasData =
    reasonForReferral ||
    (keyProblems && keyProblems.length > 0) ||
    (investigationsMentioned && investigationsMentioned.length > 0);

  if (isCleared) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-muted-foreground/30 p-4',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="font-medium">Referral Context</span>
            <span className="text-sm">(cleared)</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestore ?? onAccept}
            className="text-xs"
          >
            Restore
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border',
        isAccepted ? 'border-green-200 bg-green-50/50' : 'border-border',
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between p-4 text-left"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">Referral Context</span>
          {urgency && (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                urgency === 'urgent' && 'bg-amber-100 text-amber-700',
                urgency === 'emergency' && 'bg-red-100 text-red-700',
                urgency === 'routine' && 'bg-gray-100 text-gray-700'
              )}
            >
              {urgency}
            </span>
          )}
          {isAccepted && (
            <span className="text-xs text-green-600 font-medium">Accepted</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceIndicator confidence={confidence} showPercentage />
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t px-4 pb-4">
          {/* Reason for Referral */}
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground">
              Reason for Referral
            </Label>
            {isEditingReason ? (
              <textarea
                value={reasonForReferral || ''}
                onChange={(e) => onReasonChange(e.target.value)}
                onBlur={() => setIsEditingReason(false)}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={3}
                autoFocus
              />
            ) : (
              <button
                type="button"
                className={cn(
                  'mt-1.5 w-full rounded-md border border-transparent p-3 text-left text-sm transition-colors',
                  'hover:border-input hover:bg-muted/50',
                  !reasonForReferral && 'text-muted-foreground italic'
                )}
                onClick={() => setIsEditingReason(true)}
              >
                {reasonForReferral || 'No reason provided'}
              </button>
            )}
          </div>

          {/* Key Problems */}
          {keyProblems && keyProblems.length > 0 && (
            <div className="mt-4">
              <Label className="text-xs text-muted-foreground">
                Key Problems
              </Label>
              <ul className="mt-1.5 space-y-1">
                {keyProblems.map((problem, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {problem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Investigations */}
          {investigationsMentioned && investigationsMentioned.length > 0 && (
            <div className="mt-4">
              <Label className="text-xs text-muted-foreground">
                Investigations Mentioned
              </Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {investigationsMentioned.map((inv, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {inv}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Medications */}
          {medicationsMentioned && medicationsMentioned.length > 0 && (
            <div className="mt-4">
              <Label className="text-xs text-muted-foreground">
                Medications Mentioned
              </Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {medicationsMentioned.map((med, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700"
                  >
                    {med}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {hasData && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant={isAccepted ? 'secondary' : 'outline'}
                size="sm"
                onClick={onAccept}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                {isAccepted ? 'Accepted' : 'Accept'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
