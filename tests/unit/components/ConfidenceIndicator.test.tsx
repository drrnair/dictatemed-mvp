// tests/unit/components/ConfidenceIndicator.test.tsx
// Unit tests for ConfidenceIndicator component

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ConfidenceIndicator,
  ConfidenceIndicatorInline,
} from '@/components/referral/ConfidenceIndicator';

describe('ConfidenceIndicator', () => {
  describe('High confidence (>= 0.85)', () => {
    it('renders green check icon for high confidence', () => {
      render(<ConfidenceIndicator confidence={0.95} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-green-50');
    });

    it('shows 95% when showPercentage is true', () => {
      render(<ConfidenceIndicator confidence={0.95} showPercentage />);

      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
      render(<ConfidenceIndicator confidence={0.95} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label', 'High confidence: 95%');
    });
  });

  describe('Medium confidence (>= 0.7 and < 0.85)', () => {
    it('renders amber warning icon for medium confidence', () => {
      render(<ConfidenceIndicator confidence={0.75} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-amber-50');
    });

    it('shows 75% when showPercentage is true', () => {
      render(<ConfidenceIndicator confidence={0.75} showPercentage />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
      render(<ConfidenceIndicator confidence={0.75} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label', 'Medium confidence: 75%');
    });
  });

  describe('Low confidence (< 0.7)', () => {
    it('renders red alert icon for low confidence', () => {
      render(<ConfidenceIndicator confidence={0.45} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-red-50');
    });

    it('shows 45% when showPercentage is true', () => {
      render(<ConfidenceIndicator confidence={0.45} showPercentage />);

      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
      render(<ConfidenceIndicator confidence={0.45} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label', 'Low confidence: 45%');
    });
  });

  describe('Edge cases', () => {
    it('handles 0 confidence', () => {
      render(<ConfidenceIndicator confidence={0} showPercentage />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles 1.0 confidence', () => {
      render(<ConfidenceIndicator confidence={1.0} showPercentage />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('rounds decimal values correctly', () => {
      render(<ConfidenceIndicator confidence={0.876} showPercentage />);

      expect(screen.getByText('88%')).toBeInTheDocument();
    });

    it('handles exactly 0.85 as high confidence', () => {
      render(<ConfidenceIndicator confidence={0.85} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-green-50');
    });

    it('handles exactly 0.7 as medium confidence', () => {
      render(<ConfidenceIndicator confidence={0.7} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-amber-50');
    });
  });

  describe('Sizes', () => {
    it('applies small size by default', () => {
      const { container } = render(<ConfidenceIndicator confidence={0.9} />);

      const icon = container.querySelector('svg');
      expect(icon).toHaveClass('h-3.5', 'w-3.5');
    });

    it('applies medium size when specified', () => {
      const { container } = render(
        <ConfidenceIndicator confidence={0.9} size="md" />
      );

      const icon = container.querySelector('svg');
      expect(icon).toHaveClass('h-4', 'w-4');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(
        <ConfidenceIndicator confidence={0.9} className="custom-class" />
      );

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('custom-class');
    });
  });
});

describe('ConfidenceIndicatorInline', () => {
  it('renders percentage for high confidence', () => {
    render(<ConfidenceIndicatorInline confidence={0.95} />);

    const text = screen.getByText('95%');
    expect(text).toHaveClass('text-green-600');
  });

  it('renders percentage for medium confidence', () => {
    render(<ConfidenceIndicatorInline confidence={0.75} />);

    const text = screen.getByText('75%');
    expect(text).toHaveClass('text-amber-600');
  });

  it('renders percentage for low confidence', () => {
    render(<ConfidenceIndicatorInline confidence={0.45} />);

    const text = screen.getByText('45%');
    expect(text).toHaveClass('text-red-600');
  });

  it('applies custom className', () => {
    render(
      <ConfidenceIndicatorInline confidence={0.9} className="custom-class" />
    );

    const text = screen.getByText('90%');
    expect(text).toHaveClass('custom-class');
  });
});
