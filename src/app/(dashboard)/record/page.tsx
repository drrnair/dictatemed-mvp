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
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in-up">
      {/* Header with status */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
            New Consultation
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Set up context, then record your consultation.
          </p>
        </div>

        {/* Network and sync status */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200',
              isOnline
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
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
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 min-h-[44px]',
                'hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
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
        className="rounded-xl border-2 border-teal-200 dark:border-teal-800/50 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all duration-200"
        aria-labelledby="recording-section-title"
      >
        <h2 id="recording-section-title" className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-4">
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
            className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-3 text-amber-700 dark:text-amber-300"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm">Please complete the consultation context above before recording.</p>
          </div>
        )}
      </section>

      {/* Tip */}
      {!isRecording && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-1">
          <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" aria-hidden="true" />
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
      'rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200',
      isComplete && !isExpanded && 'border-teal-200 dark:border-teal-800/50 bg-teal-50/30 dark:bg-teal-950/10',
      disabled && 'opacity-60'
    )}>
      <CardHeader
        className={cn(
          'cursor-pointer p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200 min-h-[44px] rounded-t-xl',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
          disabled && 'cursor-not-allowed hover:bg-transparent'
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
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200',
                isComplete
                  ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              )} aria-hidden="true">
                {icon}
              </div>
            )}
            <div>
              <CardTitle className="text-base font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                {title}
                {required && <span className="text-rose-500" aria-label="required">*</span>}
                {isComplete && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Complete
                  </span>
                )}
              </CardTitle>
              {subtitle && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200',
            'hover:bg-slate-100 dark:hover:bg-slate-700'
          )}>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            )}
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 pb-6 px-6">{children}</CardContent>
      )}
    </Card>
  );
}
