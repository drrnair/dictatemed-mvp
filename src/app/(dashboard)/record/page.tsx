// src/app/(dashboard)/record/page.tsx
// Redesigned Record page with context-first workflow

'use client';

import { useState, useCallback, useRef } from 'react';
import {
  AlertCircle,
  Loader2,
  Cloud,
  CloudOff,
  Upload,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  FileText,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Consultation components
import {
  ConsultationContextForm,
  validateConsultationForm,
  type ConsultationFormData,
  PreviousMaterialsPanel,
  NewUploadsSection,
} from '@/components/consultation';

// Recording components
import {
  ConsentDialog,
  type ConsentType,
} from '@/components/recording';
import { RecordingSection } from '@/components/recording/RecordingSection';

// Hooks
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { logger } from '@/lib/logger';

const recordLogger = logger.child({ action: 'recording' });

export default function RecordPage() {
  // Consultation context state
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ConsultationFormData>({
    ccRecipients: [],
  });
  const [formErrors, setFormErrors] = useState<{
    patient?: string;
    referrer?: string;
    letterType?: string;
  }>({});

  // Selected materials for context
  const [selectedLetterIds, setSelectedLetterIds] = useState<string[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);

  // Section expansion states
  const [isContextExpanded, setIsContextExpanded] = useState(true);
  const [isMaterialsExpanded, setIsMaterialsExpanded] = useState(false);
  const [isUploadsExpanded, setIsUploadsExpanded] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const consentTypeRef = useRef<ConsentType>('VERBAL');

  const {
    pendingCount,
    syncStatus,
    isOnline,
    syncNow,
  } = useOfflineQueue();

  // Validate form before recording
  const validateBeforeRecording = useCallback((): boolean => {
    const validation = validateConsultationForm(formData);
    setFormErrors(validation.errors);

    if (!validation.isValid) {
      setIsContextExpanded(true);
      return false;
    }

    return true;
  }, [formData]);

  // Create or get consultation
  const ensureConsultation = useCallback(async (): Promise<string | null> => {
    if (consultationId) return consultationId;

    try {
      const response = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: formData.patient?.id,
          referrerId: formData.referrer?.id,
          referrer: formData.referrer?.id ? undefined : formData.referrer,
          ccRecipients: formData.ccRecipients.map(({ name, email, address }) => ({
            name,
            email,
            address,
          })),
          templateId: formData.templateId,
          letterType: formData.letterType,
          selectedLetterIds,
          selectedDocumentIds,
        }),
      });

      if (!response.ok) throw new Error('Failed to create consultation');

      const { consultation } = await response.json();
      setConsultationId(consultation.id);
      return consultation.id;
    } catch (error) {
      recordLogger.error('Failed to create consultation', {}, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }, [consultationId, formData, selectedLetterIds, selectedDocumentIds]);

  // Handle consent confirmation
  const handleConsentConfirm = useCallback(
    async (consentType: ConsentType) => {
      setShowConsentDialog(false);
      consentTypeRef.current = consentType;

      // Create consultation first
      const consId = await ensureConsultation();
      if (!consId) {
        setFormErrors((prev) => ({ ...prev, patient: 'Failed to save consultation context' }));
        return;
      }

      // Collapse the context sections once recording starts
      setIsContextExpanded(false);
      setIsMaterialsExpanded(false);
      setIsUploadsExpanded(false);
      setIsRecording(true);
    },
    [ensureConsultation]
  );

  // Handle consent cancellation
  const handleConsentCancel = useCallback(() => {
    setShowConsentDialog(false);
  }, []);

  const handleMaterialsSelectionChange = useCallback((letterIds: string[], documentIds: string[]) => {
    setSelectedLetterIds(letterIds);
    setSelectedDocumentIds(documentIds);
  }, []);

  const handleDocumentUploadComplete = useCallback((documentId: string) => {
    setSelectedDocumentIds((prev) => [...prev, documentId]);
  }, []);

  const handleRecordingComplete = useCallback((recordingId: string) => {
    recordLogger.info('Recording complete', { recordingId });
    setIsRecording(false);
  }, []);

  const isContextComplete = formData.patient && formData.referrer && formData.letterType;

  return (
    <div className="space-y-space-4 max-w-4xl mx-auto">
      {/* Header with status */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-1">New Consultation</h1>
          <p className="text-body-sm text-muted-foreground mt-space-1">
            Set up context, then record your consultation.
          </p>
        </div>

        {/* Network and sync status */}
        <div className="flex items-center gap-space-2">
          <div
            className={cn(
              'flex items-center gap-space-1 rounded-full px-space-3 py-space-1 text-caption',
              isOnline
                ? 'bg-clinical-verified/10 text-clinical-verified'
                : 'bg-destructive/10 text-destructive'
            )}
            role="status"
            aria-live="polite"
          >
            {isOnline ? (
              <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isOnline ? 'Online' : 'Offline'}
          </div>

          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => syncNow()}
              disabled={!isOnline || syncStatus === 'syncing'}
              className={cn(
                'flex items-center gap-space-1 rounded-full px-space-3 py-space-1 text-caption',
                'bg-primary/10 text-primary min-h-touch',
                'hover:bg-primary/20 transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                (!isOnline || syncStatus === 'syncing') && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={`Sync ${pendingCount} pending items`}
            >
              {syncStatus === 'syncing' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {pendingCount} pending
            </button>
          )}
        </div>
      </header>

      {/* SECTION 1: Consultation Context (Required) */}
      <CollapsibleSection
        title="1. Consultation Context"
        subtitle="Patient, referrer, and letter type"
        isExpanded={isContextExpanded}
        onToggle={() => setIsContextExpanded(!isContextExpanded)}
        isComplete={Boolean(isContextComplete)}
        required
        disabled={isRecording}
      >
        <ConsultationContextForm
          value={formData}
          onChange={setFormData}
          errors={formErrors}
          disabled={isRecording}
        />
      </CollapsibleSection>

      {/* SECTION 2: Clinical Context (Optional) */}
      {formData.patient && (
        <>
          {/* Previous Materials */}
          <CollapsibleSection
            title="2. Previous Materials"
            subtitle="Select prior letters and documents as context"
            isExpanded={isMaterialsExpanded}
            onToggle={() => setIsMaterialsExpanded(!isMaterialsExpanded)}
            isComplete={selectedLetterIds.length > 0 || selectedDocumentIds.length > 0}
            icon={<FolderOpen className="h-5 w-5" />}
            disabled={isRecording}
          >
            <PreviousMaterialsPanel
              consultationId={consultationId || undefined}
              patientId={formData.patient?.id}
              selectedLetterIds={selectedLetterIds}
              selectedDocumentIds={selectedDocumentIds}
              onSelectionChange={handleMaterialsSelectionChange}
              disabled={isRecording}
            />
          </CollapsibleSection>

          {/* New Uploads */}
          <CollapsibleSection
            title="3. Upload Documents"
            subtitle="Add referral letters, reports, or photos"
            isExpanded={isUploadsExpanded}
            onToggle={() => setIsUploadsExpanded(!isUploadsExpanded)}
            icon={<Upload className="h-5 w-5" />}
            disabled={isRecording}
          >
            <NewUploadsSection
              consultationId={consultationId || undefined}
              onUploadComplete={handleDocumentUploadComplete}
              disabled={isRecording}
            />
          </CollapsibleSection>
        </>
      )}

      {/* SECTION 3: Recording */}
      <section
        className="rounded-xl border-2 border-primary/20 bg-card p-space-6 shadow-card transition-shadow duration-150"
        aria-labelledby="recording-section-title"
      >
        <h2 id="recording-section-title" className="text-heading-2 mb-space-4">
          {formData.patient ? '4. Record Consultation' : 'Record Consultation'}
        </h2>

        {/* Recording Section with mode selector */}
        <RecordingSection
          disabled={!isContextComplete}
          consultationId={consultationId || undefined}
          onRecordingComplete={handleRecordingComplete}
        />

        {/* Validation message if context incomplete */}
        {!isContextComplete && (
          <div
            className="mt-space-4 flex items-center gap-space-2 rounded-lg bg-clinical-warning/10 p-space-3 text-clinical-warning"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <p className="text-body-sm">Please complete the consultation context above before recording.</p>
          </div>
        )}
      </section>

      {/* Tip */}
      {!isRecording && (
        <div className="flex items-center gap-space-2 text-caption text-muted-foreground px-space-1">
          <Lightbulb className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>
            Tip: Adding context improves letter quality. Include referral letters and previous correspondence when available.
          </span>
        </div>
      )}

      {/* Consent dialog */}
      <ConsentDialog
        isOpen={showConsentDialog}
        onConfirm={handleConsentConfirm}
        onCancel={handleConsentCancel}
      />
    </div>
  );
}

// Collapsible section component
interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  isExpanded: boolean;
  onToggle: () => void;
  isComplete?: boolean;
  required?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  subtitle,
  isExpanded,
  onToggle,
  isComplete,
  required,
  disabled,
  icon,
  children,
}: CollapsibleSectionProps) {
  return (
    <Card className={cn(
      'border-border/60 shadow-card transition-all duration-150',
      disabled && 'opacity-60'
    )}>
      <CardHeader
        className={cn(
          'cursor-pointer p-space-4 hover:bg-muted/30 transition-colors duration-150 min-h-touch',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          disabled && 'cursor-not-allowed'
        )}
        onClick={() => !disabled && onToggle()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onToggle();
          }
        }}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-expanded={isExpanded}
        aria-disabled={disabled}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-3">
            {icon && <div className="text-muted-foreground" aria-hidden="true">{icon}</div>}
            <div>
              <CardTitle className="text-heading-3 flex items-center gap-space-2">
                {title}
                {required && <span className="text-destructive" aria-label="required">*</span>}
                {isComplete && (
                  <span className="text-caption font-normal text-clinical-verified bg-clinical-verified/10 px-space-2 py-space-1 rounded-full">
                    Complete
                  </span>
                )}
              </CardTitle>
              {subtitle && (
                <p className="text-body-sm text-muted-foreground mt-space-1">{subtitle}</p>
              )}
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 pb-space-6 px-space-6">{children}</CardContent>
      )}
    </Card>
  );
}
