'use client';

// src/components/consultation/ConsultationContextForm.tsx
// Main form combining patient, referrer, CC recipients, and letter type selection
// Now includes optional referral upload for auto-population
// Supports multi-document upload with fast extraction and background processing

import { useCallback, useState } from 'react';
import { logger } from '@/lib/logger';
import { AlertCircle, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PatientSelector } from './PatientSelector';
import { ReferrerSelector } from './ReferrerSelector';
import { CCRecipientsInput } from './CCRecipientsInput';
import { LetterTypeSelector } from './LetterTypeSelector';
import { TemplateSelector } from './TemplateSelector';
import { PatientContacts } from './PatientContacts';
import {
  ReferralUploader,
  ReferralReviewPanel,
  BackgroundProcessingIndicator,
} from '@/components/referral';
import { toast } from '@/hooks/use-toast';
import type { PatientSummary, ReferrerInfo, CCRecipientInfo } from '@/domains/consultation';
import type { LetterType } from '@prisma/client';
import type { ReferralExtractedData, ApplyReferralInput, FastExtractedData } from '@/domains/referrals';

export interface ConsultationFormData {
  patient?: PatientSummary;
  referrer?: ReferrerInfo;
  ccRecipients: CCRecipientInfo[];
  letterType?: LetterType;
  templateId?: string;
  // Referral context (populated from referral upload)
  referralContext?: {
    reasonForReferral?: string;
    keyProblems?: string[];
  };
  referralDocumentId?: string;
  // Multi-document upload: IDs of all uploaded documents
  referralDocumentIds?: string[];
  // Fast extraction data from multi-document upload
  fastExtractionData?: FastExtractedData;
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
  /** Enable multi-document upload with fast extraction and background processing */
  multiDocumentUpload?: boolean;
  /** Show background processing indicator (when documents are being processed) */
  showBackgroundProcessing?: boolean;
  /** Number of documents being processed in background */
  processingDocumentCount?: number;
}

export function ConsultationContextForm({
  value,
  onChange,
  disabled,
  errors,
  multiDocumentUpload = false,
  showBackgroundProcessing = false,
  processingDocumentCount = 0,
}: ConsultationContextFormProps) {
  const [showContacts, setShowContacts] = useState(false);

  // Referral upload state
  const [referralId, setReferralId] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ReferralExtractedData | null>(null);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Multi-document upload state
  const [uploadedDocumentIds, setUploadedDocumentIds] = useState<string[]>([]);
  const [isMultiDocProcessing, setIsMultiDocProcessing] = useState(false);

  // Handle successful extraction (single-file mode)
  const handleExtractionComplete = useCallback(
    (id: string, data: ReferralExtractedData) => {
      setReferralId(id);
      setExtractedData(data);
      setShowReviewPanel(true);
    },
    []
  );

  // Handle fast extraction complete (multi-document mode)
  // Called when fast extraction completes with patient identifiers
  const handleFastExtractionComplete = useCallback(
    (data: FastExtractedData) => {
      // Pre-fill patient name from fast extraction if available
      const patientName = data.patientName?.value;

      // Update form with fast extraction data
      // Document IDs will be set when user clicks "Continue" (via handleMultiDocContinue)
      onChange({
        ...value,
        fastExtractionData: data,
      });

      // Show toast with extracted info
      if (patientName) {
        toast({
          title: 'Patient identified',
          description: `Found: ${patientName}. Search for this patient below.`,
        });
      }
    },
    [value, onChange]
  );

  // Handle continue from multi-document upload
  const handleMultiDocContinue = useCallback(
    (documentIds: string[]) => {
      setUploadedDocumentIds(documentIds);
      setIsMultiDocProcessing(true); // Background processing started

      // Update form with document IDs
      onChange({
        ...value,
        referralDocumentIds: documentIds,
      });

      toast({
        title: 'Documents uploaded',
        description: `${documentIds.length} document${documentIds.length !== 1 ? 's' : ''} processing in background.`,
      });
    },
    [value, onChange]
  );

  // Handle full extraction complete (background processing finished)
  const handleFullExtractionComplete = useCallback(() => {
    setIsMultiDocProcessing(false); // Background processing finished

    toast({
      title: 'Document processing complete',
      description: 'All documents have been fully processed.',
    });
  }, []);

  // Handle apply from review panel
  const handleApplyReferral = useCallback(
    async (input: ApplyReferralInput) => {
      if (!referralId) return;

      setIsApplying(true);
      try {
        const response = await fetch(`/api/referrals/${referralId}/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to apply referral');
        }

        const result = await response.json();

        // Update form with applied data
        onChange({
          ...value,
          patient: {
            id: result.patientId,
            name: input.patient.fullName,
            dateOfBirth: input.patient.dateOfBirth || '',
          },
          referrer: input.gp
            ? {
                id: result.referrerId,
                name: input.gp.fullName,
                practiceName: input.gp.practiceName,
                email: input.gp.email,
                phone: input.gp.phone,
                fax: input.gp.fax,
                address: input.gp.address,
              }
            : value.referrer,
          referralContext: input.referralContext,
          referralDocumentId: referralId,
        });

        setShowReviewPanel(false);

        // Success toast
        toast({
          title: 'Referral applied',
          description: 'Patient and referrer details have been added to the form.',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to apply referral';
        logger.error('Failed to apply referral', { error });

        // Error toast
        toast({
          title: 'Could not apply referral',
          description: `${errorMessage} Please try again or enter details manually.`,
          variant: 'destructive',
        });
        // Keep review panel open on error
      } finally {
        setIsApplying(false);
      }
    },
    [referralId, value, onChange]
  );

  // Handle cancel from review panel
  const handleCancelReview = useCallback(() => {
    setShowReviewPanel(false);
  }, []);

  // Handle remove referral
  const handleRemoveReferral = useCallback(() => {
    setReferralId(null);
    setExtractedData(null);
    setShowReviewPanel(false);
    // Clear referral-related data from form
    onChange({
      ...value,
      referralDocumentId: undefined,
      referralContext: undefined,
    });
  }, [value, onChange]);

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

  // Determine if referral has been applied
  const hasAppliedReferral = !!value.referralDocumentId;
  const hasMultiDocUpload = (value.referralDocumentIds?.length ?? 0) > 0;

  // Show background processing if explicitly set or if we have documents processing
  const shouldShowBackgroundProcessing = showBackgroundProcessing || isMultiDocProcessing;
  const effectiveProcessingCount = processingDocumentCount || uploadedDocumentIds.length;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Consultation Context</CardTitle>
          {/* Background processing indicator */}
          {shouldShowBackgroundProcessing && effectiveProcessingCount > 0 && (
            <BackgroundProcessingIndicator
              status="PROCESSING"
              documentsProcessing={effectiveProcessingCount}
              documentsTotal={effectiveProcessingCount}
              variant="inline"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Referral Upload Section - only show if no patient selected and no referral applied */}
        {!value.patient && !hasAppliedReferral && !hasMultiDocUpload && (
          <div className="rounded-lg border border-dashed border-border/60 p-4 bg-muted/30">
            <h3 className="text-sm font-medium mb-3">
              Upload referral or previous letter (optional)
            </h3>
            <ReferralUploader
              onExtractionComplete={handleExtractionComplete}
              onFastExtractionComplete={handleFastExtractionComplete}
              onContinue={handleMultiDocContinue}
              onFullExtractionComplete={handleFullExtractionComplete}
              onRemove={handleRemoveReferral}
              disabled={disabled}
              multiDocument={multiDocumentUpload}
            />
          </div>
        )}

        {/* Multi-document upload indicator */}
        {hasMultiDocUpload && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-primary mb-1">
                  {value.referralDocumentIds?.length} document{(value.referralDocumentIds?.length ?? 0) !== 1 ? 's' : ''} uploaded
                </h3>
                {value.fastExtractionData?.patientName?.value && (
                  <p className="text-sm text-muted-foreground">
                    Patient: {value.fastExtractionData.patientName.value}
                    {value.fastExtractionData.dateOfBirth?.value && (
                      <> • DOB: {value.fastExtractionData.dateOfBirth.value}</>
                    )}
                  </p>
                )}
              </div>
              {isMultiDocProcessing && (
                <BackgroundProcessingIndicator
                  status="PROCESSING"
                  documentsProcessing={effectiveProcessingCount}
                  documentsTotal={effectiveProcessingCount}
                  variant="inline"
                />
              )}
            </div>
          </div>
        )}

        {/* Applied referral indicator */}
        {hasAppliedReferral && value.referralContext?.reasonForReferral && (
          <div className="rounded-lg border border-clinical-verified/30 bg-clinical-verified/5 p-4">
            <h3 className="text-sm font-medium text-clinical-verified mb-2">
              Referral context applied
            </h3>
            <p className="text-sm text-muted-foreground">
              {value.referralContext.reasonForReferral}
            </p>
            {value.referralContext.keyProblems && value.referralContext.keyProblems.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {value.referralContext.keyProblems.map((problem, i) => (
                  <span
                    key={i}
                    className="text-xs bg-clinical-verified/10 text-clinical-verified px-2 py-0.5 rounded"
                  >
                    {problem}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Patient selection */}
        <div>
          <PatientSelector
            value={value.patient}
            onChange={handlePatientChange}
            disabled={disabled}
            initialSearchQuery={value.fastExtractionData?.patientName?.value || undefined}
          />
          {errors?.patient && (
            <p className="mt-1 flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.patient}
            </p>
          )}
        </div>

        {/* Patient Contacts - show when patient is selected */}
        {value.patient && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <Button
              type="button"
              variant="ghost"
              className="-m-2 w-full justify-between p-2 hover:bg-transparent"
              onClick={() => setShowContacts(!showContacts)}
              disabled={disabled}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                Manage Patient Contacts
              </span>
              {showContacts ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {showContacts && (
              <div className="mt-4">
                <PatientContacts
                  patientId={value.patient.id}
                  compact={false}
                />
              </div>
            )}
          </div>
        )}

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

      {/* Referral Review Panel */}
      {extractedData && (
        <ReferralReviewPanel
          open={showReviewPanel}
          onOpenChange={setShowReviewPanel}
          extractedData={extractedData}
          onApply={handleApplyReferral}
          onCancel={handleCancelReview}
          isApplying={isApplying}
        />
      )}
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
