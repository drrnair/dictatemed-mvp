'use client';

// src/components/consultation/ConsultationContextForm.tsx
// Main form combining patient, referrer, CC recipients, and letter type selection

import { useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PatientSelector } from './PatientSelector';
import { ReferrerSelector } from './ReferrerSelector';
import { CCRecipientsInput } from './CCRecipientsInput';
import { LetterTypeSelector } from './LetterTypeSelector';
import { TemplateSelector } from './TemplateSelector';
import type { PatientSummary, ReferrerInfo, CCRecipientInfo } from '@/domains/consultation';
import type { LetterType } from '@prisma/client';

export interface ConsultationFormData {
  patient?: PatientSummary;
  referrer?: ReferrerInfo;
  ccRecipients: CCRecipientInfo[];
  letterType?: LetterType;
  templateId?: string;
}

interface ConsultationContextFormProps {
  value: ConsultationFormData;
  onChange: (data: ConsultationFormData) => void;
  disabled?: boolean;
  errors?: {
    patient?: string;
    referrer?: string;
    letterType?: string;
  };
}

export function ConsultationContextForm({
  value,
  onChange,
  disabled,
  errors,
}: ConsultationContextFormProps) {
  const handlePatientChange = useCallback(
    (patient: PatientSummary | undefined) => {
      onChange({ ...value, patient });
    },
    [value, onChange]
  );

  const handleReferrerChange = useCallback(
    (referrer: ReferrerInfo | undefined) => {
      onChange({ ...value, referrer });
    },
    [value, onChange]
  );

  const handleCCRecipientsChange = useCallback(
    (ccRecipients: CCRecipientInfo[]) => {
      onChange({ ...value, ccRecipients });
    },
    [value, onChange]
  );

  const handleLetterTypeChange = useCallback(
    (letterType: LetterType) => {
      onChange({ ...value, letterType });
    },
    [value, onChange]
  );

  const handleTemplateChange = useCallback(
    (templateId: string | undefined) => {
      onChange({ ...value, templateId });
    },
    [value, onChange]
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Consultation Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Patient selection */}
        <div>
          <PatientSelector
            value={value.patient}
            onChange={handlePatientChange}
            disabled={disabled}
          />
          {errors?.patient && (
            <p className="mt-1 flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.patient}
            </p>
          )}
        </div>

        {/* Referrer selection */}
        <div>
          <ReferrerSelector
            value={value.referrer}
            onChange={handleReferrerChange}
            disabled={disabled}
          />
          {errors?.referrer && (
            <p className="mt-1 flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.referrer}
            </p>
          )}
        </div>

        {/* CC Recipients */}
        <CCRecipientsInput
          value={value.ccRecipients}
          onChange={handleCCRecipientsChange}
          disabled={disabled}
        />

        {/* Letter type selection */}
        <div>
          <LetterTypeSelector
            value={value.letterType}
            onChange={handleLetterTypeChange}
            disabled={disabled}
          />
          {errors?.letterType && (
            <p className="mt-1 flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.letterType}
            </p>
          )}
        </div>

        {/* Template selection (optional) */}
        <TemplateSelector
          value={value.templateId}
          onChange={handleTemplateChange}
          letterType={value.letterType}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Validate consultation form data
 */
export function validateConsultationForm(data: ConsultationFormData): {
  isValid: boolean;
  errors: { patient?: string; referrer?: string; letterType?: string };
} {
  const errors: { patient?: string; referrer?: string; letterType?: string } = {};

  if (!data.patient) {
    errors.patient = 'Please select a patient';
  }

  if (!data.referrer) {
    errors.referrer = 'Please select a referring doctor';
  }

  if (!data.letterType) {
    errors.letterType = 'Please select a letter type';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
