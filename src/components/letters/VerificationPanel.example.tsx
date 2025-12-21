'use client';

/**
 * Example usage of VerificationPanel component
 *
 * This demonstrates how to integrate the VerificationPanel into a letter editing workflow
 */

import * as React from 'react';
import { VerificationPanel } from './VerificationPanel';
import type { ExtractedValue, HallucinationFlag } from './VerificationPanel';

export function VerificationPanelExample() {
  // Mock extracted values
  const [extractedValues, setExtractedValues] = React.useState<ExtractedValue[]>([
    {
      id: 'val-1',
      category: 'cardiac_function',
      name: 'Left Ventricular Ejection Fraction (LVEF)',
      value: '55',
      unit: '%',
      sourceAnchorId: 'transcript-anchor-123',
      verified: false,
      critical: true,
    },
    {
      id: 'val-2',
      category: 'cardiac_function',
      name: 'Left Ventricular End-Diastolic Diameter',
      value: '5.2',
      unit: 'cm',
      sourceAnchorId: 'transcript-anchor-124',
      verified: false,
      critical: false,
    },
    {
      id: 'val-3',
      category: 'coronary_disease',
      name: 'LAD Stenosis',
      value: '70',
      unit: '%',
      sourceAnchorId: 'transcript-anchor-125',
      verified: false,
      critical: true,
    },
    {
      id: 'val-4',
      category: 'coronary_disease',
      name: 'RCA Stenosis',
      value: '40',
      unit: '%',
      sourceAnchorId: 'transcript-anchor-126',
      verified: false,
      critical: true,
    },
    {
      id: 'val-5',
      category: 'valvular',
      name: 'Aortic Valve Area',
      value: '1.2',
      unit: 'cm²',
      sourceAnchorId: 'transcript-anchor-127',
      verified: false,
      critical: false,
    },
    {
      id: 'val-6',
      category: 'medication',
      name: 'Aspirin Dose',
      value: '81',
      unit: 'mg',
      sourceAnchorId: 'transcript-anchor-128',
      verified: false,
      critical: false,
    },
    {
      id: 'val-7',
      category: 'medication',
      name: 'Metoprolol Dose',
      value: '50',
      unit: 'mg BID',
      sourceAnchorId: 'transcript-anchor-129',
      verified: false,
      critical: false,
    },
    {
      id: 'val-8',
      category: 'procedural',
      name: 'Stent Size',
      value: '3.0 x 18',
      unit: 'mm',
      sourceAnchorId: 'transcript-anchor-130',
      verified: false,
      critical: false,
    },
  ]);

  // Mock hallucination flags
  const [hallucinationFlags, setHallucinationFlags] = React.useState<HallucinationFlag[]>([
    {
      id: 'flag-1',
      flaggedText: 'Patient has complete resolution of symptoms',
      reason: 'No mention of symptom resolution in original transcript',
      severity: 'critical',
      dismissed: false,
    },
    {
      id: 'flag-2',
      flaggedText: 'Previous MI in 2015',
      reason: 'Transcript mentions "history of chest pain" but no specific MI date',
      severity: 'warning',
      dismissed: false,
    },
    {
      id: 'flag-3',
      flaggedText: 'Family history of sudden cardiac death',
      reason: 'Family history not discussed in transcript',
      severity: 'warning',
      dismissed: false,
    },
  ]);

  // Handler: Verify individual value
  const handleVerifyValue = (valueId: string) => {
    setExtractedValues((prev) =>
      prev.map((val) =>
        val.id === valueId ? { ...val, verified: true } : val
      )
    );
    // eslint-disable-next-line no-console
    console.log('Verified value:', valueId);
  };

  // Handler: Verify all values
  const handleVerifyAll = () => {
    setExtractedValues((prev) =>
      prev.map((val) => ({ ...val, verified: true }))
    );
    // eslint-disable-next-line no-console
    console.log('Verified all values');
  };

  // Handler: Dismiss hallucination flag
  const handleDismissFlag = (flagId: string, reason: string) => {
    setHallucinationFlags((prev) =>
      prev.map((flag) =>
        flag.id === flagId
          ? { ...flag, dismissed: true, dismissedReason: reason }
          : flag
      )
    );
    // eslint-disable-next-line no-console
    console.log('Dismissed flag:', flagId, 'Reason:', reason);
  };

  // Handler: View value source
  const handleValueClick = (valueId: string) => {
    const value = extractedValues.find((v) => v.id === valueId);
    if (value) {
      // eslint-disable-next-line no-console
      console.log('Navigate to source:', value.sourceAnchorId);
      // In real implementation, this would scroll to the source in the transcript
      // and highlight the relevant text
      alert(`Would navigate to: ${value.sourceAnchorId}`);
    }
  };

  // Calculate if letter can be approved
  const canApprove = React.useMemo(() => {
    const allValuesVerified = extractedValues.every((v) => v.verified);
    const noCriticalFlags = hallucinationFlags.filter(
      (f) => f.severity === 'critical' && !f.dismissed
    ).length === 0;

    return allValuesVerified && noCriticalFlags;
  }, [extractedValues, hallucinationFlags]);

  return (
    <div className="flex h-screen">
      {/* Main Content Area (Letter Editor would go here) */}
      <div className="flex-1 p-8 bg-background">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Letter Editor</h1>
          <div className="bg-card border rounded-lg p-6 mb-4">
            <p className="text-muted-foreground">
              Main letter content would appear here...
            </p>
          </div>

          {/* Approval Status */}
          <div className="mt-8 p-4 bg-muted rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Approval Status</h2>
            {canApprove ? (
              <div className="text-clinical-verified">
                ✓ Letter is ready for approval
              </div>
            ) : (
              <div className="text-clinical-warning">
                ⚠ Please complete verification before approving
              </div>
            )}
            <button
              className={`mt-4 px-4 py-2 rounded-md ${
                canApprove
                  ? 'bg-clinical-verified text-white hover:bg-clinical-verified/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
              disabled={!canApprove}
            >
              Approve & Send Letter
            </button>
          </div>
        </div>
      </div>

      {/* Verification Panel (Right Sidebar) */}
      <div className="w-96 flex-shrink-0">
        <VerificationPanel
          extractedValues={extractedValues}
          hallucinationFlags={hallucinationFlags}
          onVerifyValue={handleVerifyValue}
          onVerifyAll={handleVerifyAll}
          onDismissFlag={handleDismissFlag}
          onValueClick={handleValueClick}
        />
      </div>
    </div>
  );
}

/**
 * Integration Notes:
 *
 * 1. Data Sources:
 *    - extractedValues: Populated from AI extraction service after processing transcript
 *    - hallucinationFlags: Generated by AI hallucination detection service
 *
 * 2. Source Navigation:
 *    - onValueClick should scroll to transcript/report and highlight source text
 *    - Use sourceAnchorId to locate the relevant text section
 *
 * 3. Approval Logic:
 *    - ALL critical values MUST be verified
 *    - ALL critical hallucination flags must be dismissed with reason
 *    - Consider adding final approval confirmation dialog
 *
 * 4. Persistence:
 *    - Save verification state to database as user verifies values
 *    - Store dismissal reasons for audit trail
 *    - Track who verified each value and when
 *
 * 5. Accessibility:
 *    - Component includes ARIA labels and keyboard navigation
 *    - Test with screen readers
 *    - Ensure tab order is logical
 *
 * 6. Testing:
 *    - Use data-testid attributes for E2E tests
 *    - Test approval blocking when critical values unverified
 *    - Test flag dismissal workflow
 *    - Test keyboard navigation
 */
