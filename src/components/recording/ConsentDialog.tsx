// src/components/recording/ConsentDialog.tsx
// Patient consent dialog with consent type selection

'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, FileText, MessageSquare, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConsentType = 'VERBAL' | 'WRITTEN' | 'STANDING';

interface ConsentDialogProps {
  isOpen: boolean;
  onConfirm: (consentType: ConsentType) => void;
  onCancel: () => void;
  patientName?: string;
}

const consentOptions = [
  {
    value: 'VERBAL' as const,
    label: 'Verbal Consent',
    description: 'Patient has verbally agreed to the recording',
    icon: MessageSquare,
  },
  {
    value: 'WRITTEN' as const,
    label: 'Written Consent',
    description: 'Patient has signed a consent form',
    icon: FileText,
  },
  {
    value: 'STANDING' as const,
    label: 'Standing Consent',
    description: 'Patient has prior consent on file',
    icon: Shield,
  },
];

export function ConsentDialog({
  isOpen,
  onConfirm,
  onCancel,
  patientName,
}: ConsentDialogProps) {
  const [selectedConsent, setSelectedConsent] = useState<ConsentType | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedConsent && confirmed) {
      onConfirm(selectedConsent);
      // Reset state
      setSelectedConsent(null);
      setConfirmed(false);
    }
  };

  const handleCancel = () => {
    setSelectedConsent(null);
    setConfirmed(false);
    onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-dialog-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleCancel}
        onKeyDown={(e) => e.key === 'Escape' && handleCancel()}
        aria-label="Close dialog"
        tabIndex={-1}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <h2 id="consent-dialog-title" className="text-lg font-semibold">Patient Consent Required</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {patientName
              ? `Confirm recording consent for ${patientName}`
              : 'Confirm patient has consented to this recording'}
          </p>
        </div>

        {/* Consent type selection */}
        <div className="mb-6 space-y-3">
          {consentOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedConsent === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedConsent(option.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
                {isSelected && (
                  <CheckCircle className="ml-auto h-5 w-5 text-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Confirmation checkbox */}
        <label className="mb-6 flex items-start gap-3 rounded-lg border border-border p-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm">
            I confirm that the patient has provided informed consent for this
            clinical recording, which will be processed using AI-assisted
            transcription.
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedConsent || !confirmed}
            className={cn(
              'flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors',
              'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              (!selectedConsent || !confirmed) && 'cursor-not-allowed opacity-50'
            )}
          >
            Start Recording
          </button>
        </div>
      </div>
    </div>
  );
}
