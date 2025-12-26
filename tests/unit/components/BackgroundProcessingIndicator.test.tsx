// tests/unit/components/BackgroundProcessingIndicator.test.tsx
// Unit tests for BackgroundProcessingIndicator component

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  BackgroundProcessingIndicator,
  BackgroundProcessingBadge,
  BackgroundProcessingInfo,
} from '@/components/referral/BackgroundProcessingIndicator';

describe('BackgroundProcessingIndicator', () => {
  describe('Not started state', () => {
    it('renders nothing when status is not_started and no documents', () => {
      const { container } = render(
        <BackgroundProcessingIndicator status="not_started" />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Inline variant (default)', () => {
    describe('Processing state', () => {
      it('shows processing message for PENDING status', () => {
        render(
          <BackgroundProcessingIndicator
            status="PENDING"
            documentsTotal={3}
          />
        );

        expect(screen.getByText(/Processing documents/)).toBeInTheDocument();
      });

      it('shows processing message for PROCESSING status', () => {
        render(
          <BackgroundProcessingIndicator
            status="PROCESSING"
            documentsTotal={3}
          />
        );

        expect(screen.getByText(/Processing documents/)).toBeInTheDocument();
      });

      it('shows document count when processing', () => {
        render(
          <BackgroundProcessingIndicator
            status="PROCESSING"
            documentsComplete={1}
            documentsTotal={3}
          />
        );

        expect(screen.getByText('Processing documents (1/3)')).toBeInTheDocument();
      });
    });

    describe('Failed state', () => {
      it('shows failure message for FAILED status', () => {
        render(<BackgroundProcessingIndicator status="FAILED" />);

        expect(
          screen.getByText('Some documents failed to process')
        ).toBeInTheDocument();
      });
    });

    describe('Complete state', () => {
      it('renders nothing when all complete', () => {
        const { container } = render(
          <BackgroundProcessingIndicator
            status="COMPLETE"
            documentsComplete={3}
            documentsTotal={3}
          />
        );

        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe('Banner variant', () => {
    describe('Processing state', () => {
      it('shows processing banner with blue styling', () => {
        render(
          <BackgroundProcessingIndicator
            status="PROCESSING"
            variant="banner"
            documentsTotal={3}
          />
        );

        const indicator = screen.getByTestId('background-processing-indicator');
        expect(indicator).toHaveClass('bg-blue-50/50', 'border-blue-200');
      });

      it('shows processing heading', () => {
        render(
          <BackgroundProcessingIndicator
            status="PROCESSING"
            variant="banner"
            documentsTotal={3}
          />
        );

        expect(
          screen.getByText('Processing documents in background')
        ).toBeInTheDocument();
      });

      it('shows "You can continue recording" message', () => {
        render(
          <BackgroundProcessingIndicator
            status="PROCESSING"
            variant="banner"
            documentsTotal={2}
          />
        );

        expect(
          screen.getByText(/You can continue recording/)
        ).toBeInTheDocument();
      });

      it('shows progress dots for multiple documents', () => {
        render(
          <BackgroundProcessingIndicator
            status="PROCESSING"
            variant="banner"
            documentsComplete={1}
            documentsProcessing={1}
            documentsTotal={3}
          />
        );

        // Should render 3 progress indicators
        const indicator = screen.getByTestId('background-processing-indicator');
        const progressDots = indicator.querySelectorAll('.h-1\\.5.rounded-full');
        expect(progressDots.length).toBe(3);
      });
    });

    describe('Complete state', () => {
      it('shows complete banner with green styling', () => {
        render(
          <BackgroundProcessingIndicator
            status="COMPLETE"
            variant="banner"
            documentsComplete={3}
            documentsTotal={3}
          />
        );

        const indicator = screen.getByTestId('background-processing-indicator');
        expect(indicator).toHaveClass('bg-green-50/50', 'border-green-200');
      });

      it('shows complete heading', () => {
        render(
          <BackgroundProcessingIndicator
            status="COMPLETE"
            variant="banner"
            documentsTotal={3}
          />
        );

        expect(
          screen.getByText('Document processing complete')
        ).toBeInTheDocument();
      });

      it('shows correct plural message for multiple documents', () => {
        render(
          <BackgroundProcessingIndicator
            status="COMPLETE"
            variant="banner"
            documentsTotal={3}
          />
        );

        expect(
          screen.getByText(/All 3 documents have been fully processed/)
        ).toBeInTheDocument();
      });

      it('shows correct singular message for single document', () => {
        render(
          <BackgroundProcessingIndicator
            status="COMPLETE"
            variant="banner"
            documentsTotal={1}
          />
        );

        expect(
          screen.getByText(/All 1 document has been fully processed/)
        ).toBeInTheDocument();
      });
    });

    describe('Failed state', () => {
      it('shows failed banner with amber styling', () => {
        render(
          <BackgroundProcessingIndicator
            status="FAILED"
            variant="banner"
          />
        );

        const indicator = screen.getByTestId('background-processing-indicator');
        expect(indicator).toHaveClass('bg-amber-50/50', 'border-amber-200');
      });

      it('shows failed heading', () => {
        render(
          <BackgroundProcessingIndicator
            status="FAILED"
            variant="banner"
          />
        );

        expect(
          screen.getByText('Some documents could not be processed')
        ).toBeInTheDocument();
      });

      it('shows custom error message when provided', () => {
        render(
          <BackgroundProcessingIndicator
            status="FAILED"
            variant="banner"
            error="Network timeout while processing"
          />
        );

        expect(
          screen.getByText(/Network timeout while processing/)
        ).toBeInTheDocument();
      });

      it('shows default error message when no error provided', () => {
        render(
          <BackgroundProcessingIndicator
            status="FAILED"
            variant="banner"
          />
        );

        expect(
          screen.getByText(/Failed to extract complete details/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Data attributes', () => {
    it('has correct status data attribute', () => {
      render(
        <BackgroundProcessingIndicator
          status="PROCESSING"
          documentsTotal={3}
        />
      );

      const indicator = screen.getByTestId('background-processing-indicator');
      expect(indicator).toHaveAttribute('data-status', 'PROCESSING');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(
        <BackgroundProcessingIndicator
          status="PROCESSING"
          documentsTotal={1}
          className="custom-class"
        />
      );

      expect(screen.getByTestId('background-processing-indicator')).toHaveClass(
        'custom-class'
      );
    });
  });
});

describe('BackgroundProcessingBadge', () => {
  describe('Visibility', () => {
    it('renders nothing when status is COMPLETE', () => {
      const { container } = render(
        <BackgroundProcessingBadge status="COMPLETE" />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when status is not_started', () => {
      const { container } = render(
        <BackgroundProcessingBadge status="not_started" />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders for PENDING status', () => {
      render(<BackgroundProcessingBadge status="PENDING" />);

      expect(screen.getByTestId('background-processing-badge')).toBeInTheDocument();
    });

    it('renders for PROCESSING status', () => {
      render(<BackgroundProcessingBadge status="PROCESSING" />);

      expect(screen.getByTestId('background-processing-badge')).toBeInTheDocument();
    });

    it('renders for FAILED status', () => {
      render(<BackgroundProcessingBadge status="FAILED" />);

      expect(screen.getByTestId('background-processing-badge')).toBeInTheDocument();
    });
  });

  describe('Processing state', () => {
    it('shows "Processing" text', () => {
      render(<BackgroundProcessingBadge status="PROCESSING" />);

      expect(screen.getByText(/Processing/)).toBeInTheDocument();
    });

    it('shows document count when provided', () => {
      render(
        <BackgroundProcessingBadge
          status="PROCESSING"
          documentsComplete={1}
          documentsTotal={3}
        />
      );

      expect(screen.getByText('Processing 1/3')).toBeInTheDocument();
    });

    it('applies blue styling', () => {
      render(<BackgroundProcessingBadge status="PROCESSING" />);

      const badge = screen.getByTestId('background-processing-badge');
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-700');
    });
  });

  describe('Failed state', () => {
    it('shows "Processing issues" text', () => {
      render(<BackgroundProcessingBadge status="FAILED" />);

      expect(screen.getByText('Processing issues')).toBeInTheDocument();
    });

    it('applies amber styling', () => {
      render(<BackgroundProcessingBadge status="FAILED" />);

      const badge = screen.getByTestId('background-processing-badge');
      expect(badge).toHaveClass('bg-amber-100', 'text-amber-700');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(
        <BackgroundProcessingBadge
          status="PROCESSING"
          className="custom-class"
        />
      );

      expect(screen.getByTestId('background-processing-badge')).toHaveClass(
        'custom-class'
      );
    });
  });
});

describe('BackgroundProcessingInfo', () => {
  it('renders info banner', () => {
    render(<BackgroundProcessingInfo />);

    expect(screen.getByTestId('background-processing-info')).toBeInTheDocument();
  });

  it('shows heading text', () => {
    render(<BackgroundProcessingInfo />);

    expect(
      screen.getByText('Documents will be fully processed in the background')
    ).toBeInTheDocument();
  });

  it('shows description text', () => {
    render(<BackgroundProcessingInfo />);

    expect(
      screen.getByText(/You can start recording immediately/)
    ).toBeInTheDocument();
  });

  it('mentions detailed context extraction', () => {
    render(<BackgroundProcessingInfo />);

    expect(
      screen.getByText(/referral reason, medical history, medications/)
    ).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<BackgroundProcessingInfo className="custom-class" />);

    expect(screen.getByTestId('background-processing-info')).toHaveClass(
      'custom-class'
    );
  });
});
