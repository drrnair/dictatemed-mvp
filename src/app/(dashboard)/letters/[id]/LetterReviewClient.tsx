'use client';

// src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx
// Client component for interactive letter review

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LetterEditor } from '@/components/letters/LetterEditor';
import { SourcePanel } from '@/components/letters/SourcePanel';
import {
  VerificationPanel,
  type ExtractedValue,
  type HallucinationFlag,
} from '@/components/letters/VerificationPanel';
import { DifferentialView } from '@/components/letters/DifferentialView';
import { SendLetterDialog } from '@/components/letters/SendLetterDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Send } from 'lucide-react';

// Proper type definitions instead of `any`
interface SourceAnchor {
  id: string;
  textStart: number;
  textEnd: number;
  sourceType: 'transcript' | 'document';
  sourceId: string;
  sourceLocation: string;
  excerpt: string;
}

interface SourceData {
  type: 'transcript' | 'document';
  id: string;
  name: string;
  content: string;
  highlightStart: number;
  highlightEnd: number;
  metadata?: {
    speaker?: string;
    timestamp?: string;
    page?: number;
    confidence?: number;
  };
}

interface PatientData {
  id: string;
  name: string;
}

interface RecordingData {
  id: string;
  transcriptText?: string | null;
}

interface DocumentData {
  id: string;
  document: {
    id: string;
    name: string;
    extractedText?: string | null;
  };
}

interface LetterWithRelations {
  id: string;
  letterType: string;
  status: 'GENERATING' | 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'FAILED';
  contentDraft: string | null;
  contentFinal: string | null;
  extractedValues: unknown[] | null;
  hallucinationFlags: unknown[] | null;
  sourceAnchors: { anchors: unknown[] } | null;
  hallucinationRiskScore: number | null;
  createdAt: string;
  reviewStartedAt: string | null;
  approvedAt: string | null;
  patient: PatientData | null;
  recording: RecordingData | null;
  documents: DocumentData[];
}

interface LetterReviewClientProps {
  letter: LetterWithRelations;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    subspecialties?: string[];
  };
}

export function LetterReviewClient({
  letter,
  currentUser,
}: LetterReviewClientProps) {
  const router = useRouter();
  const [content, setContent] = useState(letter.contentDraft || '');
  const [originalContent] = useState(letter.contentDraft || '');
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false);
  const [activeSourceAnchor, setActiveSourceAnchor] = useState<SourceAnchor | null>(null);
  const [sourceData, setSourceData] = useState<SourceData | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);

  // Immutable state for extracted values and flags - cast from unknown[]
  const [localExtractedValues, setLocalExtractedValues] = useState<ExtractedValue[]>(
    () => (letter.extractedValues as ExtractedValue[] | null) || []
  );
  const [localHallucinationFlags, setLocalHallucinationFlags] = useState<HallucinationFlag[]>(
    () => (letter.hallucinationFlags as HallucinationFlag[] | null) || []
  );

  const isReadOnly = letter.status === 'APPROVED';
  const hasChanges = content !== originalContent;
  const isModified = letter.contentFinal && letter.contentFinal !== letter.contentDraft;

  // Memoize source anchors to prevent unnecessary re-renders - cast from unknown[]
  const sourceAnchors = useMemo(() => {
    return (letter.sourceAnchors?.anchors as SourceAnchor[] | undefined) || [];
  }, [letter.sourceAnchors]);

  // Calculate verification progress
  const totalValues = localExtractedValues.length;
  const verifiedCount = localExtractedValues.filter((v) => v.verified).length;
  const verificationProgress =
    totalValues > 0 ? Math.round((verifiedCount / totalValues) * 100) : 100;

  // Check if all critical values are verified
  const criticalValues = localExtractedValues.filter((v) => v.critical);
  const allCriticalVerified = criticalValues.every((v) => v.verified);

  const canApprove = allCriticalVerified && !hasChanges;

  // Ref to track in-flight save request and prevent race conditions
  const saveAbortControllerRef = useRef<AbortController | null>(null);
  const pendingSaveRef = useRef<string | null>(null);

  // Stable save function wrapped in useCallback with request deduplication
  const handleSaveDraft = useCallback(async () => {
    if (isReadOnly) return;

    // Cancel any in-flight request
    if (saveAbortControllerRef.current) {
      saveAbortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    saveAbortControllerRef.current = abortController;

    // Track the content being saved to detect if it changed
    const contentToSave = content;
    pendingSaveRef.current = contentToSave;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/letters/${letter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentFinal: contentToSave }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }

      // Clear pending save only if content hasn't changed during save
      if (pendingSaveRef.current === contentToSave) {
        pendingSaveRef.current = null;
      }
    } catch (error) {
      // Ignore abort errors (expected when request is cancelled)
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      // Log non-abort errors
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.error('Error saving draft:', error);
      }
    } finally {
      // Only clear saving state if this is still the active request
      if (saveAbortControllerRef.current === abortController) {
        setIsSaving(false);
        saveAbortControllerRef.current = null;
      }
    }
  }, [isReadOnly, letter.id, content]);

  // Auto-save draft with proper cleanup
  useEffect(() => {
    if (hasChanges && !isReadOnly) {
      const timer = setTimeout(() => {
        handleSaveDraft().catch(() => {
          // Error already logged in handleSaveDraft
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [content, hasChanges, isReadOnly, handleSaveDraft]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (saveAbortControllerRef.current) {
        saveAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch source data when active anchor changes
  useEffect(() => {
    if (!activeSourceAnchor) {
      setSourceData(null);
      return;
    }

    // Find the source data based on the anchor
    const anchor = activeSourceAnchor;

    if (anchor.sourceType === 'transcript' && letter.recording?.transcriptText) {
      // Extract transcript excerpt around the anchor
      const transcriptText = letter.recording.transcriptText;
      const highlightStart = Math.max(0, parseInt(anchor.sourceLocation.split(':')[1] || '0', 10));
      const highlightEnd = Math.min(transcriptText.length, highlightStart + anchor.excerpt.length);

      setSourceData({
        type: 'transcript',
        id: letter.recording.id,
        name: 'Recording Transcript',
        content: transcriptText,
        highlightStart,
        highlightEnd,
        metadata: {
          timestamp: anchor.sourceLocation.replace('timestamp:', ''),
          confidence: 0.95,
        },
      });
    } else if (anchor.sourceType === 'document') {
      // Find the document
      const docEntry = letter.documents.find((d) => d.document.id === anchor.sourceId);
      if (docEntry?.document.extractedText) {
        const docText = docEntry.document.extractedText;
        const locationParts = anchor.sourceLocation.split(',');
        const page = parseInt(locationParts[0]?.replace('page:', '') || '1', 10);

        setSourceData({
          type: 'document',
          id: docEntry.document.id,
          name: docEntry.document.name,
          content: docText,
          highlightStart: 0,
          highlightEnd: anchor.excerpt.length,
          metadata: {
            page,
            confidence: 0.9,
          },
        });
      }
    }
  }, [activeSourceAnchor, letter.recording, letter.documents]);

  const handlePreview = () => {
    setIsPreviewing(true);
    // Open print preview
    window.print();
    setTimeout(() => setIsPreviewing(false), 500);
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/letters/${letter.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedValues: localExtractedValues.map((v) => ({
            id: v.id,
            verified: v.verified,
          })),
          hallucinationFlags: localHallucinationFlags.map((f) => ({
            id: f.id,
            dismissed: f.dismissed,
            dismissedReason: f.dismissedReason,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve letter');
      }

      // Redirect to letters list or show success
      router.push('/letters?approved=true');
      router.refresh();
    } catch (error) {
      console.error('Error approving letter:', error);
    } finally {
      setIsApproving(false);
      setShowApprovalDialog(false);
    }
  };

  // Immutable state updates for verification
  const handleValueVerify = useCallback((valueId: string) => {
    setLocalExtractedValues((prev) =>
      prev.map((v) =>
        v.id === valueId ? { ...v, verified: !v.verified } : v
      )
    );
  }, []);

  const handleVerifyAll = useCallback(() => {
    setLocalExtractedValues((prev) =>
      prev.map((v) => ({ ...v, verified: true }))
    );
  }, []);

  const handleFlagDismiss = useCallback((flagId: string, reason: string) => {
    setLocalHallucinationFlags((prev) =>
      prev.map((f) =>
        f.id === flagId ? { ...f, dismissed: true, dismissedReason: reason } : f
      )
    );
  }, []);

  const handleValueClick = useCallback(
    (valueId: string) => {
      const value = localExtractedValues.find((v) => v.id === valueId);
      if (value) {
        // Find the full anchor data from sourceAnchors
        const anchor = sourceAnchors.find((a) => a.id === value.sourceAnchorId);
        if (anchor) {
          setActiveSourceAnchor(anchor);
          setSourcePanelOpen(true);
        }
      }
    },
    [localExtractedValues, sourceAnchors]
  );

  const handleEditorSourceClick = useCallback(
    (anchorId: string) => {
      const anchor = sourceAnchors.find((a) => a.id === anchorId);
      if (anchor) {
        setActiveSourceAnchor(anchor);
        setSourcePanelOpen(true);
      }
    },
    [sourceAnchors]
  );

  const handleViewFullSource = useCallback(
    (sourceId: string, sourceType: 'transcript' | 'document') => {
      // Open in new tab/modal
      if (sourceType === 'transcript') {
        window.open(`/recordings/${sourceId}`, '_blank');
      } else {
        window.open(`/documents/${sourceId}`, '_blank');
      }
    },
    []
  );

  const formatLetterType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      'default' | 'secondary' | 'verified' | 'warning' | 'destructive' | 'outline' | 'critical'
    > = {
      GENERATING: 'default',
      DRAFT: 'secondary',
      IN_REVIEW: 'warning',
      APPROVED: 'verified',
      FAILED: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/letters')}
            >
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
              Back to Letters
            </Button>

            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold">
                  {letter.patient?.name || 'Unknown Patient'}
                </h1>
                <span className="text-sm text-muted-foreground">|</span>
                <span className="text-sm text-muted-foreground">
                  {formatLetterType(letter.letterType)}
                </span>
                {getStatusBadge(letter.status)}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Created {new Date(letter.createdAt).toLocaleDateString()}</span>
                {letter.reviewStartedAt && (
                  <>
                    <span>•</span>
                    <span>
                      Review started {new Date(letter.reviewStartedAt).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-save indicator */}
            {isSaving && (
              <span className="text-xs text-muted-foreground">Saving...</span>
            )}

            {/* Show diff toggle if modified */}
            {isModified && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiff(!showDiff)}
              >
                {showDiff ? 'Hide' : 'Show'} Changes
              </Button>
            )}

            {/* Preview button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={isPreviewing}
            >
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
              Preview
            </Button>

            {/* Save draft button */}
            {!isReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={!hasChanges || isSaving}
              >
                Save Draft
              </Button>
            )}

            {/* Approve button */}
            {!isReadOnly && (
              <Button
                size="sm"
                onClick={() => setShowApprovalDialog(true)}
                disabled={!canApprove}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                Approve Letter
              </Button>
            )}

            {isReadOnly && letter.approvedAt && (
              <Badge variant="verified" className="text-sm">
                Approved on {new Date(letter.approvedAt).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>

        {/* Verification progress */}
        {!isReadOnly && totalValues > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Verification: {verifiedCount}/{totalValues} values verified
            </span>
            <div className="h-2 flex-1 max-w-xs overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-green-600 transition-all"
                style={{ width: `${verificationProgress}%` }}
              />
            </div>
            <span className="text-xs font-medium">{verificationProgress}%</span>
            {!allCriticalVerified && (
              <span className="text-xs text-amber-600">
                Critical values need verification
              </span>
            )}
          </div>
        )}
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Verification Panel (left) */}
        <aside className="w-80 overflow-y-auto border-r border-border bg-card">
          <VerificationPanel
            extractedValues={localExtractedValues}
            hallucinationFlags={localHallucinationFlags}
            onVerifyValue={handleValueVerify}
            onVerifyAll={handleVerifyAll}
            onDismissFlag={handleFlagDismiss}
            onValueClick={handleValueClick}
          />
        </aside>

        {/* Center content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Differential view (collapsible) */}
          {showDiff && isModified && (
            <div className="border-b border-border p-4">
              <DifferentialView
                originalContent={letter.contentDraft || ''}
                modifiedContent={letter.contentFinal || ''}
                viewMode="unified"
                compact={true}
              />
            </div>
          )}

          {/* Letter editor */}
          <div className="flex-1 overflow-y-auto p-6">
            <LetterEditor
              letterId={letter.id}
              initialContent={content}
              sourceAnchors={sourceAnchors}
              readOnly={isReadOnly}
              onContentChange={setContent}
              onSourceClick={handleEditorSourceClick}
              onSave={handleSaveDraft}
            />
          </div>
        </main>

        {/* Source Panel (right, slides in) */}
        <SourcePanel
          isOpen={sourcePanelOpen}
          onClose={() => {
            setSourcePanelOpen(false);
            setActiveSourceAnchor(null);
          }}
          activeAnchor={activeSourceAnchor}
          sourceData={sourceData}
          onViewFullSource={handleViewFullSource}
        />
      </div>

      {/* Approval confirmation dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Letter?</DialogTitle>
            <DialogDescription>
              You are about to approve this letter for{' '}
              <strong>{letter.patient?.name || 'Unknown Patient'}</strong>.
              Once approved, the letter cannot be edited.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm">Values verified:</span>
              <span className="font-semibold">
                {verifiedCount}/{totalValues}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm">Critical values verified:</span>
              <span
                className={`font-semibold ${
                  allCriticalVerified
                    ? 'text-green-600'
                    : 'text-amber-600'
                }`}
              >
                {allCriticalVerified ? 'Yes' : 'No'}
              </span>
            </div>

            {letter.hallucinationRiskScore !== null && (
              <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                <span className="text-sm">Hallucination risk:</span>
                <span
                  className={`font-semibold ${
                    letter.hallucinationRiskScore < 30
                      ? 'text-green-600'
                      : letter.hallucinationRiskScore < 70
                        ? 'text-amber-600'
                        : 'text-red-600'
                  }`}
                >
                  {letter.hallucinationRiskScore}/100
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isApproving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isApproving ? 'Approving...' : 'Approve & Finalize'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
