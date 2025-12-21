'use client';

// src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx
// Client component for interactive letter review

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LetterEditor } from '@/components/letters/LetterEditor';
import { SourcePanel } from '@/components/letters/SourcePanel';
import {
  VerificationPanel,
  type ExtractedValue,
  type HallucinationFlag,
} from '@/components/letters/VerificationPanel';
import { DifferentialView } from '@/components/letters/DifferentialView';
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

interface LetterReviewClientProps {
  letter: any; // Letter with all relations
  currentUser: {
    id: string;
    name: string;
    role: string;
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
  const [activeSourceAnchor, setActiveSourceAnchor] = useState<any>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const isReadOnly = letter.status === 'APPROVED';
  const hasChanges = content !== originalContent;
  const isModified = letter.contentFinal && letter.contentFinal !== letter.contentDraft;

  // Parse extracted values and hallucination flags
  const extractedValues: ExtractedValue[] = (letter.extractedValues as any[]) || [];
  const hallucinationFlags: HallucinationFlag[] = (letter.hallucinationFlags as any[]) || [];

  // Calculate verification progress
  const totalValues = extractedValues.length;
  const verifiedCount = extractedValues.filter((v) => v.verified).length;
  const verificationProgress =
    totalValues > 0 ? Math.round((verifiedCount / totalValues) * 100) : 100;

  // Check if all critical values are verified
  const criticalValues = extractedValues.filter((v) => v.critical);
  const allCriticalVerified = criticalValues.every((v) => v.verified);

  const canApprove = allCriticalVerified && !hasChanges;

  // Auto-save draft
  useEffect(() => {
    if (hasChanges && !isReadOnly) {
      const timer = setTimeout(() => {
        void handleSaveDraft();
      }, 2000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [content, hasChanges, isReadOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveDraft = async () => {
    if (isReadOnly) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/letters/${letter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentFinal: content }),
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      // TODO: Show error toast
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = () => {
    setIsPreviewing(true);
    // TODO: Open preview modal or new window
    // For now, just toggle flag
    setTimeout(() => setIsPreviewing(false), 1000);
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/letters/${letter.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedValues: extractedValues.map((v) => ({
            id: v.id,
            verified: v.verified,
          })),
          hallucinationFlags: hallucinationFlags.map((f) => ({
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
      // TODO: Show error toast
    } finally {
      setIsApproving(false);
      setShowApprovalDialog(false);
    }
  };

  const handleValueVerify = useCallback(
    (valueId: string) => {
      // Toggle verification status
      extractedValues.forEach((v) => {
        if (v.id === valueId) {
          v.verified = !v.verified;
        }
      });
    },
    [extractedValues]
  );

  const handleVerifyAll = useCallback(() => {
    extractedValues.forEach((v) => {
      v.verified = true;
    });
  }, [extractedValues]);

  const handleFlagDismiss = useCallback(
    (flagId: string, reason: string) => {
      hallucinationFlags.forEach((f) => {
        if (f.id === flagId) {
          f.dismissed = true;
          f.dismissedReason = reason;
        }
      });
    },
    [hallucinationFlags]
  );

  const handleValueClick = useCallback(
    (valueId: string) => {
      const value = extractedValues.find((v) => v.id === valueId);
      if (value) {
        setActiveSourceAnchor({
          id: value.sourceAnchorId,
          // Find the actual anchor data from sourceAnchors
        });
        setSourcePanelOpen(true);
      }
    },
    [extractedValues]
  );

  const handleEditorSourceClick = useCallback((anchorId: string) => {
    setActiveSourceAnchor({ id: anchorId });
    setSourcePanelOpen(true);
  }, []);

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
                className="bg-clinical-verified hover:bg-clinical-verified/90"
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

            {isReadOnly && (
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
                className="h-full bg-clinical-verified transition-all"
                style={{ width: `${verificationProgress}%` }}
              />
            </div>
            <span className="text-xs font-medium">{verificationProgress}%</span>
            {!allCriticalVerified && (
              <span className="text-xs text-clinical-warning">
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
            extractedValues={extractedValues}
            hallucinationFlags={hallucinationFlags}
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
              sourceAnchors={((letter.sourceAnchors as any)?.anchors as any[]) || []}
              readOnly={isReadOnly}
              onContentChange={setContent}
              onSourceClick={handleEditorSourceClick}
              onSave={handleSaveDraft}
            />
          </div>
        </main>

        {/* Source Panel (right, slides in) */}
        {sourcePanelOpen && activeSourceAnchor && (
          <aside className="w-96 overflow-y-auto border-l border-border bg-card">
            <SourcePanel
              isOpen={sourcePanelOpen}
              onClose={() => setSourcePanelOpen(false)}
              activeAnchor={activeSourceAnchor}
              sourceData={null}
              onViewFullSource={(sourceId, sourceType) => {
                // TODO: Open full source view
                console.log('View full source:', sourceId, sourceType);
              }}
            />
          </aside>
        )}
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
                    ? 'text-clinical-verified'
                    : 'text-clinical-warning'
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
                      ? 'text-clinical-verified'
                      : letter.hallucinationRiskScore < 70
                        ? 'text-clinical-warning'
                        : 'text-clinical-critical'
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
              className="bg-clinical-verified hover:bg-clinical-verified/90"
            >
              {isApproving ? 'Approving...' : 'Approve & Finalize'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
