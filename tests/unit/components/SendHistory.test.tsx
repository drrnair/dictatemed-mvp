// tests/unit/components/SendHistory.test.tsx
// Unit tests for SendHistory component

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SendHistory } from '@/components/letters/SendHistory';
import type { SendStatus, ContactType } from '@prisma/client';

// Mock the tooltip component to simplify testing
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span data-testid="tooltip">{children}</span>,
}));

describe('SendHistory', () => {
  const mockLetterId = 'letter-123';

  interface HistoryItem {
    id: string;
    recipientName: string;
    recipientEmail: string;
    recipientType: ContactType | null;
    channel: string;
    subject: string;
    status: SendStatus;
    queuedAt: string;
    sentAt: string | null;
    failedAt: string | null;
    errorMessage: string | null;
  }

  const createMockHistory = (overrides: Partial<HistoryItem> = {}): HistoryItem => ({
    id: 'send-1',
    recipientName: 'Dr. John Smith',
    recipientEmail: 'dr.smith@example.com',
    recipientType: 'GP' as ContactType,
    channel: 'EMAIL',
    subject: 'Patient Letter',
    status: 'SENT' as SendStatus,
    queuedAt: '2024-12-22T10:00:00Z',
    sentAt: '2024-12-22T10:30:00Z',
    failedAt: null,
    errorMessage: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty state', () => {
    it('displays empty state when no history', () => {
      render(<SendHistory letterId={mockLetterId} history={[]} />);

      expect(screen.getByText('This letter has not been sent yet.')).toBeInTheDocument();
    });

    it('does not show retry button in empty state', () => {
      render(<SendHistory letterId={mockLetterId} history={[]} onRetry={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });
  });

  describe('Send history display', () => {
    it('displays send count in header', () => {
      const history = [
        createMockHistory({ id: 'send-1' }),
        createMockHistory({ id: 'send-2', recipientName: 'Dr. Jane Doe' }),
      ];

      render(<SendHistory letterId={mockLetterId} history={history} />);

      expect(screen.getByText('Send History')).toBeInTheDocument();
      expect(screen.getByText('2 sends')).toBeInTheDocument();
    });

    it('shows singular "send" for single item', () => {
      render(<SendHistory letterId={mockLetterId} history={[createMockHistory()]} />);

      expect(screen.getByText('1 send')).toBeInTheDocument();
    });

    it('displays recipient name and email', () => {
      render(<SendHistory letterId={mockLetterId} history={[createMockHistory()]} />);

      expect(screen.getByText('Dr. John Smith')).toBeInTheDocument();
      expect(screen.getByText('dr.smith@example.com')).toBeInTheDocument();
    });

    it('displays recipient type badge', () => {
      render(<SendHistory letterId={mockLetterId} history={[createMockHistory()]} />);

      expect(screen.getByText('GP')).toBeInTheDocument();
    });

    it('displays different recipient types correctly', () => {
      const history = [
        createMockHistory({ id: '1', recipientType: 'REFERRER' as ContactType }),
        createMockHistory({ id: '2', recipientType: 'SPECIALIST' as ContactType }),
        createMockHistory({ id: '3', recipientType: 'OTHER' as ContactType }),
      ];

      render(<SendHistory letterId={mockLetterId} history={history} />);

      expect(screen.getByText('Referrer')).toBeInTheDocument();
      expect(screen.getByText('Specialist')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    it('handles null recipient type', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ recipientType: null })]}
        />
      );

      expect(screen.getByText('Dr. John Smith')).toBeInTheDocument();
      // Should not have a type badge for GP
      expect(screen.queryByText('GP')).not.toBeInTheDocument();
    });
  });

  describe('Status display', () => {
    it('shows SENT status badge', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'SENT' as SendStatus })]}
        />
      );

      expect(screen.getByText('SENT')).toBeInTheDocument();
    });

    it('shows FAILED status badge', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' as SendStatus })]}
        />
      );

      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });

    it('shows QUEUED status badge', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'QUEUED' as SendStatus })]}
        />
      );

      expect(screen.getByText('QUEUED')).toBeInTheDocument();
    });

    it('shows SENDING status badge', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'SENDING' as SendStatus })]}
        />
      );

      expect(screen.getByText('SENDING')).toBeInTheDocument();
    });

    it('shows BOUNCED status badge', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'BOUNCED' as SendStatus })]}
        />
      );

      expect(screen.getByText('BOUNCED')).toBeInTheDocument();
    });
  });

  describe('Error display', () => {
    it('displays error message for failed sends', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[
            createMockHistory({
              status: 'FAILED' as SendStatus,
              errorMessage: 'Connection timeout',
              failedAt: '2024-12-22T10:35:00Z',
            }),
          ]}
        />
      );

      expect(screen.getByText(/Error: Connection timeout/)).toBeInTheDocument();
    });

    it('truncates long error messages', () => {
      const longError = 'This is a very long error message that should be truncated in the display';
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[
            createMockHistory({
              status: 'FAILED' as SendStatus,
              errorMessage: longError,
            }),
          ]}
        />
      );

      // Should show truncated message with ellipsis
      expect(screen.getByText(/Error: This is a very long error message th.../)).toBeInTheDocument();
    });

    it('shows failed send row with warning styling', () => {
      const { container } = render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' as SendStatus })]}
        />
      );

      // Check for red border class on the row
      const row = container.querySelector('.border-red-200');
      expect(row).toBeInTheDocument();
    });
  });

  describe('Retry functionality', () => {
    it('shows retry button for failed sends when onRetry provided', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' as SendStatus })]}
          onRetry={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('does not show retry button when onRetry not provided', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' as SendStatus })]}
        />
      );

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('does not show retry button for successful sends', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'SENT' as SendStatus })]}
          onRetry={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('calls onRetry with sendId when retry clicked', async () => {
      const mockRetry = vi.fn().mockResolvedValue(undefined);
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ id: 'send-123', status: 'FAILED' as SendStatus })]}
          onRetry={mockRetry}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(mockRetry).toHaveBeenCalledWith('send-123');
      });
    });

    it('disables retry button during retry', async () => {
      const mockRetry = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' as SendStatus })]}
          onRetry={mockRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(retryButton).toBeDisabled();
    });

    it('shows error message when retry fails', async () => {
      const mockRetry = vi.fn().mockRejectedValue(new Error('Retry failed'));
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' as SendStatus })]}
          onRetry={mockRetry}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText('Retry failed')).toBeInTheDocument();
      });
    });

    it('shows generic error for non-Error rejections', async () => {
      const mockRetry = vi.fn().mockRejectedValue('Unknown error');
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' as SendStatus })]}
          onRetry={mockRetry}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText('Retry failed')).toBeInTheDocument();
      });
    });
  });

  describe('Multiple sends', () => {
    it('renders multiple send items', () => {
      const history = [
        createMockHistory({ id: '1', recipientName: 'Dr. Smith', status: 'SENT' as SendStatus }),
        createMockHistory({ id: '2', recipientName: 'Dr. Jones', status: 'FAILED' as SendStatus }),
        createMockHistory({ id: '3', recipientName: 'Dr. Wilson', status: 'QUEUED' as SendStatus }),
      ];

      render(<SendHistory letterId={mockLetterId} history={history} />);

      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
      expect(screen.getByText('Dr. Jones')).toBeInTheDocument();
      expect(screen.getByText('Dr. Wilson')).toBeInTheDocument();
      expect(screen.getByText('3 sends')).toBeInTheDocument();
    });

    it('only shows retry for failed sends in mixed list', () => {
      const history = [
        createMockHistory({ id: '1', status: 'SENT' as SendStatus }),
        createMockHistory({ id: '2', status: 'FAILED' as SendStatus }),
        createMockHistory({ id: '3', status: 'QUEUED' as SendStatus }),
      ];

      render(<SendHistory letterId={mockLetterId} history={history} onRetry={vi.fn()} />);

      const retryButtons = screen.getAllByRole('button', { name: /retry/i });
      expect(retryButtons).toHaveLength(1);
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      const { container } = render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory()]}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
