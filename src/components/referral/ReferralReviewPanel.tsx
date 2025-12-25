'use client';

// src/components/referral/ReferralReviewPanel.tsx
// Review and edit panel for extracted referral data

import { useState, useCallback, useMemo } from 'react';
import { User, Building2, Stethoscope, FileText, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  ReferralFieldGroup,
  ReferralContextFieldGroup,
  type FieldConfig,
} from './ReferralFieldGroup';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import {
  MEDIUM_CONFIDENCE_THRESHOLD,
  type ReferralExtractedData,
  type ExtractedPatientInfo,
  type ExtractedGPInfo,
  type ExtractedReferrerInfo,
  type ExtractedReferralContext,
  type ApplyReferralInput,
} from '@/domains/referrals';

// Section acceptance state
interface SectionState {
  patient: 'pending' | 'accepted' | 'cleared';
  gp: 'pending' | 'accepted' | 'cleared';
  referrer: 'pending' | 'accepted' | 'cleared';
  context: 'pending' | 'accepted' | 'cleared';
}

export interface ReferralReviewPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractedData: ReferralExtractedData;
  onApply: (data: ApplyReferralInput) => void;
  onCancel: () => void;
  isApplying?: boolean;
}

export function ReferralReviewPanel({
  open,
  onOpenChange,
  extractedData,
  onApply,
  onCancel,
  isApplying = false,
}: ReferralReviewPanelProps) {
  // Editable copies of extracted data
  const [patient, setPatient] = useState<ExtractedPatientInfo>(
    extractedData.patient
  );
  const [gp, setGp] = useState<ExtractedGPInfo>(extractedData.gp);
  const [referrer, setReferrer] = useState<ExtractedReferrerInfo | undefined>(
    extractedData.referrer
  );
  const [context, setContext] = useState<ExtractedReferralContext>(
    extractedData.referralContext
  );

  // Section states
  const [sectionState, setSectionState] = useState<SectionState>({
    patient: 'pending',
    gp: 'pending',
    referrer: 'pending',
    context: 'pending',
  });

  // Check if we can apply (at least patient name is required)
  const canApply = useMemo(() => {
    if (sectionState.patient === 'cleared') return false;
    return !!patient.fullName && patient.fullName.trim() !== '';
  }, [sectionState.patient, patient.fullName]);

  // Build apply input from current state
  const buildApplyInput = useCallback((): ApplyReferralInput => {
    const input: ApplyReferralInput = {
      patient: {
        fullName: patient.fullName || '',
        dateOfBirth: patient.dateOfBirth,
        sex: patient.sex,
        medicare: patient.medicare,
        mrn: patient.mrn,
        address: patient.address,
        phone: patient.phone,
        email: patient.email,
      },
    };

    if (sectionState.gp !== 'cleared' && gp.fullName) {
      input.gp = {
        fullName: gp.fullName,
        practiceName: gp.practiceName,
        address: gp.address,
        phone: gp.phone,
        fax: gp.fax,
        email: gp.email,
      };
    }

    if (sectionState.referrer !== 'cleared' && referrer?.fullName) {
      input.referrer = {
        fullName: referrer.fullName,
        specialty: referrer.specialty,
        organisation: referrer.organisation,
        address: referrer.address,
        phone: referrer.phone,
        fax: referrer.fax,
        email: referrer.email,
      };
    }

    if (sectionState.context !== 'cleared') {
      input.referralContext = {
        reasonForReferral: context.reasonForReferral,
        keyProblems: context.keyProblems,
      };
    }

    return input;
  }, [patient, gp, referrer, context, sectionState]);

  // Handle apply
  const handleApply = useCallback(() => {
    const input = buildApplyInput();
    onApply(input);
  }, [buildApplyInput, onApply]);

  // Patient field handlers
  const handlePatientFieldChange = useCallback((key: string, value: string) => {
    setPatient((prev) => ({ ...prev, [key]: value }));
  }, []);

  const patientFields: FieldConfig[] = useMemo(
    () => [
      { key: 'fullName', label: 'Full Name', value: patient.fullName },
      {
        key: 'dateOfBirth',
        label: 'Date of Birth',
        value: patient.dateOfBirth,
        type: 'date',
        placeholder: 'YYYY-MM-DD',
      },
      {
        key: 'sex',
        label: 'Sex',
        value: patient.sex,
        placeholder: 'male / female / other',
      },
      { key: 'medicare', label: 'Medicare', value: patient.medicare },
      { key: 'mrn', label: 'MRN', value: patient.mrn },
      { key: 'address', label: 'Address', value: patient.address },
      { key: 'phone', label: 'Phone', value: patient.phone, type: 'tel' },
      { key: 'email', label: 'Email', value: patient.email, type: 'email' },
    ],
    [patient]
  );

  // GP field handlers
  const handleGpFieldChange = useCallback((key: string, value: string) => {
    setGp((prev) => ({ ...prev, [key]: value }));
  }, []);

  const gpFields: FieldConfig[] = useMemo(
    () => [
      { key: 'fullName', label: 'Name', value: gp.fullName },
      { key: 'practiceName', label: 'Practice', value: gp.practiceName },
      { key: 'address', label: 'Address', value: gp.address },
      { key: 'phone', label: 'Phone', value: gp.phone, type: 'tel' },
      { key: 'fax', label: 'Fax', value: gp.fax, type: 'tel' },
      { key: 'email', label: 'Email', value: gp.email, type: 'email' },
      { key: 'providerNumber', label: 'Provider Number', value: gp.providerNumber },
    ],
    [gp]
  );

  // Referrer field handlers
  const handleReferrerFieldChange = useCallback((key: string, value: string) => {
    setReferrer((prev) => (prev ? { ...prev, [key]: value } : undefined));
  }, []);

  const referrerFields: FieldConfig[] = useMemo(
    () =>
      referrer
        ? [
            { key: 'fullName', label: 'Name', value: referrer.fullName },
            { key: 'specialty', label: 'Specialty', value: referrer.specialty },
            {
              key: 'organisation',
              label: 'Organisation',
              value: referrer.organisation,
            },
            { key: 'address', label: 'Address', value: referrer.address },
            { key: 'phone', label: 'Phone', value: referrer.phone, type: 'tel' },
            { key: 'email', label: 'Email', value: referrer.email, type: 'email' },
          ]
        : [],
    [referrer]
  );

  // Section action handlers
  const handleSectionAction = useCallback(
    (section: keyof SectionState, action: 'accept' | 'clear') => {
      setSectionState((prev) => ({
        ...prev,
        [section]: action === 'accept' ? 'accepted' : 'cleared',
      }));
    },
    []
  );

  const handleSectionRestore = useCallback((section: keyof SectionState) => {
    setSectionState((prev) => ({
      ...prev,
      [section]: 'pending',
    }));
  }, []);

  // Context handlers
  const handleReasonChange = useCallback((value: string) => {
    setContext((prev) => ({ ...prev, reasonForReferral: value }));
  }, []);

  const handleProblemsChange = useCallback((problems: string[]) => {
    setContext((prev) => ({ ...prev, keyProblems: problems }));
  }, []);

  // Check for low confidence warning
  const hasLowConfidence = extractedData.overallConfidence < MEDIUM_CONFIDENCE_THRESHOLD;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0" data-testid="referral-review-panel">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Review Extracted Details
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2">
              <span>Verify the extracted information before applying to the consultation.</span>
              <ConfidenceIndicator
                confidence={extractedData.overallConfidence}
                showPercentage
                size="md"
              />
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Low confidence warning */}
        {hasLowConfidence && (
          <div className="mx-6 mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="low-confidence-warning">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">
                Low extraction confidence
              </p>
              <p className="text-amber-700">
                Some information may be incomplete or inaccurate. Please review
                carefully and edit as needed.
              </p>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-4">
            {/* Patient Section */}
            <div data-testid="patient-section">
              <ReferralFieldGroup
                title="Patient Details"
                icon={<User className="h-4 w-4 text-primary" />}
                confidence={patient.confidence}
                fields={patientFields}
                onFieldChange={handlePatientFieldChange}
                onAccept={() => handleSectionAction('patient', 'accept')}
                onClear={() => handleSectionAction('patient', 'clear')}
                onRestore={() => handleSectionRestore('patient')}
                isAccepted={sectionState.patient === 'accepted'}
                isCleared={sectionState.patient === 'cleared'}
              />
            </div>

            {/* GP Section */}
            <div data-testid="gp-section">
              <ReferralFieldGroup
                title="GP Details"
                icon={<Building2 className="h-4 w-4 text-primary" />}
                confidence={gp.confidence}
                fields={gpFields}
                onFieldChange={handleGpFieldChange}
                onAccept={() => handleSectionAction('gp', 'accept')}
                onClear={() => handleSectionAction('gp', 'clear')}
                onRestore={() => handleSectionRestore('gp')}
                isAccepted={sectionState.gp === 'accepted'}
                isCleared={sectionState.gp === 'cleared'}
              />
            </div>

            {/* Referrer Section (if different from GP) */}
            {referrer && (
              <div data-testid="referrer-section">
                <ReferralFieldGroup
                  title="Referrer Details"
                  icon={<Stethoscope className="h-4 w-4 text-primary" />}
                  confidence={referrer.confidence}
                  fields={referrerFields}
                  onFieldChange={handleReferrerFieldChange}
                  onAccept={() => handleSectionAction('referrer', 'accept')}
                  onClear={() => handleSectionAction('referrer', 'clear')}
                  onRestore={() => handleSectionRestore('referrer')}
                  isAccepted={sectionState.referrer === 'accepted'}
                  isCleared={sectionState.referrer === 'cleared'}
                />
              </div>
            )}

            {/* Referral Context Section */}
            <div data-testid="context-section">
              <ReferralContextFieldGroup
                confidence={context.confidence}
                reasonForReferral={context.reasonForReferral}
                keyProblems={context.keyProblems}
                investigationsMentioned={context.investigationsMentioned}
                medicationsMentioned={context.medicationsMentioned}
                urgency={context.urgency}
                onReasonChange={handleReasonChange}
                onProblemsChange={handleProblemsChange}
                onAccept={() => handleSectionAction('context', 'accept')}
                onClear={() => handleSectionAction('context', 'clear')}
                onRestore={() => handleSectionRestore('context')}
                isAccepted={sectionState.context === 'accepted'}
                isCleared={sectionState.context === 'cleared'}
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex w-full items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {sectionState.patient === 'cleared'
                ? 'Patient data is required'
                : 'Click Apply to populate the consultation form'}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onCancel} disabled={isApplying} data-testid="referral-cancel-button">
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={!canApply || isApplying}
                className={cn(isApplying && 'opacity-70')}
                data-testid="referral-apply-button"
              >
                {isApplying ? 'Applying...' : 'Apply to Consultation'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
