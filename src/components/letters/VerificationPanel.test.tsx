/**
 * VerificationPanel Component Tests
 *
 * Tests the medical safety verification workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { VerificationPanel } from './VerificationPanel';
import type { ExtractedValue, HallucinationFlag } from './VerificationPanel';

describe('VerificationPanel', () => {
  // Mock data
  const mockValues: ExtractedValue[] = [
    {
      id: 'val-1',
      category: 'cardiac_function',
      name: 'LVEF',
      value: '55',
      unit: '%',
      sourceAnchorId: 'anchor-1',
      verified: false,
      critical: true,
    },
    {
      id: 'val-2',
      category: 'coronary_disease',
      name: 'LAD Stenosis',
      value: '70',
      unit: '%',
      sourceAnchorId: 'anchor-2',
      verified: false,
      critical: true,
    },
    {
      id: 'val-3',
      category: 'medication',
      name: 'Aspirin',
      value: '81',
      unit: 'mg',
      sourceAnchorId: 'anchor-3',
      verified: true,
      critical: false,
    },
  ];

  const mockFlags: HallucinationFlag[] = [
    {
      id: 'flag-1',
      flaggedText: 'Complete symptom resolution',
      reason: 'Not mentioned in transcript',
      severity: 'critical',
      dismissed: false,
    },
    {
      id: 'flag-2',
      flaggedText: 'Previous MI in 2015',
      reason: 'Date not specified',
      severity: 'warning',
      dismissed: false,
    },
  ];

  const mockHandlers = {
    onVerifyValue: vi.fn(),
    onVerifyAll: vi.fn(),
    onDismissFlag: vi.fn(),
    onValueClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the verification panel', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      expect(screen.getByTestId('verification-panel')).toBeInTheDocument();
      expect(screen.getByText('Clinical Verification')).toBeInTheDocument();
    });

    it('displays progress indicator correctly', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      // 1 of 3 values verified (val-3)
      expect(screen.getByText(/1 of 3 verified/i)).toBeInTheDocument();
      expect(screen.getByText('33%')).toBeInTheDocument();
    });

    it('shows critical values warning when unverified', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      expect(
        screen.getByText(/2 critical values? require verification/i)
      ).toBeInTheDocument();
    });

    it('displays hallucination flags', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Complete symptom resolution')).toBeInTheDocument();
      expect(screen.getByText('Previous MI in 2015')).toBeInTheDocument();
      expect(screen.getByText(/AI Hallucination Flags \(2\)/i)).toBeInTheDocument();
    });

    it('groups values by category', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Cardiac Function')).toBeInTheDocument();
      expect(screen.getByText('Coronary Disease')).toBeInTheDocument();
      expect(screen.getByText('Medications')).toBeInTheDocument();
    });

    it('marks critical values with asterisk', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      const lvefCard = screen.getByTestId('value-card-val-1');
      expect(within(lvefCard).getByTitle('Critical value - must be verified')).toBeInTheDocument();
    });
  });

  describe('Value Verification', () => {
    it('calls onVerifyValue when checkbox is clicked', async () => {
      const user = userEvent.setup();

      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      const checkbox = screen.getByTestId('verify-checkbox-val-1');
      await user.click(checkbox);

      expect(mockHandlers.onVerifyValue).toHaveBeenCalledWith('val-1');
    });

    it('calls onVerifyAll when verify all button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      const verifyAllButton = screen.getByTestId('verify-all-button');
      await user.click(verifyAllButton);

      expect(mockHandlers.onVerifyAll).toHaveBeenCalled();
    });

    it('disables verify all button when all verified', () => {
      const allVerifiedValues = mockValues.map((v) => ({ ...v, verified: true }));

      render(
        <VerificationPanel
          extractedValues={allVerifiedValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      const verifyAllButton = screen.getByTestId('verify-all-button');
      expect(verifyAllButton).toBeDisabled();
      expect(screen.getByText('All Verified')).toBeInTheDocument();
    });

    it('calls onValueClick when view source is clicked', async () => {
      const user = userEvent.setup();

      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      const viewSourceButton = screen.getByTestId('view-source-val-1');
      await user.click(viewSourceButton);

      expect(mockHandlers.onValueClick).toHaveBeenCalledWith('val-1');
    });

    it('displays verified state correctly', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      const verifiedCard = screen.getByTestId('value-card-val-3');
      expect(verifiedCard).toHaveAttribute('data-verified', 'true');
    });
  });

  describe('Hallucination Flags', () => {
    it('opens dismiss dialog when dismiss button clicked', async () => {
      const user = userEvent.setup();

      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      const dismissButton = screen.getByTestId('dismiss-flag-flag-1');
      await user.click(dismissButton);

      expect(screen.getByTestId('dismiss-flag-dialog')).toBeInTheDocument();
      expect(screen.getByText('Dismiss Hallucination Flag')).toBeInTheDocument();
    });

    it('requires reason to dismiss flag', async () => {
      const user = userEvent.setup();

      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      // Open dialog
      const dismissButton = screen.getByTestId('dismiss-flag-flag-1');
      await user.click(dismissButton);

      // Confirm button should be disabled without reason
      const confirmButton = screen.getByTestId('confirm-dismiss-button');
      expect(confirmButton).toBeDisabled();

      // Type reason
      const reasonInput = screen.getByTestId('dismiss-reason-input');
      await user.type(reasonInput, 'Verified with patient records');

      // Now confirm should be enabled
      expect(confirmButton).toBeEnabled();
    });

    it('calls onDismissFlag with reason', async () => {
      const user = userEvent.setup();

      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      // Open dialog
      await user.click(screen.getByTestId('dismiss-flag-flag-1'));

      // Enter reason
      const reasonInput = screen.getByTestId('dismiss-reason-input');
      await user.type(reasonInput, 'Confirmed accurate');

      // Confirm
      const confirmButton = screen.getByTestId('confirm-dismiss-button');
      await user.click(confirmButton);

      expect(mockHandlers.onDismissFlag).toHaveBeenCalledWith(
        'flag-1',
        'Confirmed accurate'
      );
    });

    it('displays critical and warning flags differently', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      const criticalFlag = screen.getByTestId('flag-card-flag-1');
      const warningFlag = screen.getByTestId('flag-card-flag-2');

      expect(criticalFlag).toHaveAttribute('data-severity', 'critical');
      expect(warningFlag).toHaveAttribute('data-severity', 'warning');
    });

    it('hides dismissed flags', () => {
      const flagsWithDismissed = [
        ...mockFlags,
        {
          id: 'flag-3',
          flaggedText: 'Dismissed flag',
          reason: 'Test',
          severity: 'warning' as const,
          dismissed: true,
          dismissedReason: 'Not relevant',
        },
      ];

      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={flagsWithDismissed}
          {...mockHandlers}
        />
      );

      expect(screen.queryByText('Dismissed flag')).not.toBeInTheDocument();
      // Should only show 2 active flags
      expect(screen.getByText(/AI Hallucination Flags \(2\)/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      expect(screen.getByLabelText('Verify LVEF')).toBeInTheDocument();
      expect(screen.getByLabelText('View source for LVEF')).toBeInTheDocument();
      expect(screen.getByLabelText('Verify all clinical values')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      const viewSourceButton = screen.getByTestId('view-source-val-1');

      // Focus and activate with keyboard
      viewSourceButton.focus();
      await user.keyboard('{Enter}');

      expect(mockHandlers.onValueClick).toHaveBeenCalledWith('val-1');
    });

    it('has proper role for alert', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty values array', () => {
      render(
        <VerificationPanel
          extractedValues={[]}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('No clinical values extracted yet')).toBeInTheDocument();
      expect(screen.getByText('0 of 0 verified')).toBeInTheDocument();
    });

    it('handles no flags', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={[]}
          {...mockHandlers}
        />
      );

      expect(screen.queryByText(/AI Hallucination Flags/i)).not.toBeInTheDocument();
    });

    it('shows 100% when all values verified', () => {
      const allVerified = mockValues.map((v) => ({ ...v, verified: true }));

      render(
        <VerificationPanel
          extractedValues={allVerified}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('3 of 3 verified')).toBeInTheDocument();
    });

    it('handles values without units', () => {
      const valueWithoutUnit: ExtractedValue = {
        id: 'val-4',
        category: 'procedural',
        name: 'Procedure Type',
        value: 'PCI',
        sourceAnchorId: 'anchor-4',
        verified: false,
        critical: false,
      };

      render(
        <VerificationPanel
          extractedValues={[valueWithoutUnit]}
          hallucinationFlags={[]}
          {...mockHandlers}
        />
      );

      const card = screen.getByTestId('value-card-val-4');
      expect(within(card).getByText('PCI')).toBeInTheDocument();
    });
  });

  describe('Category Badges', () => {
    it('shows correct verification count per category', () => {
      render(
        <VerificationPanel
          extractedValues={mockValues}
          hallucinationFlags={mockFlags}
          {...mockHandlers}
        />
      );

      // Cardiac Function: 0/1 verified
      // Coronary Disease: 0/1 verified
      // Medications: 1/1 verified

      const medicationsSection = screen.getByText('Medications').closest('button');
      expect(within(medicationsSection!).getByText('1/1')).toBeInTheDocument();
    });
  });
});
