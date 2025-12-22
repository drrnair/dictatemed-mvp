// tests/unit/components/SendHistory.test.tsx
// Unit tests for SendHistory component

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SendHistory } from '@/components/letters/SendHistory';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Send: () => <span data-testid="send-icon" />,
  CheckCircle: () => <span data-testid="check-icon" />,
  XCircle: () => <span data-testid="x-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
  RefreshCw: () => <span data-testid="refresh-icon" />,
  Mail: () => <span data-testid="mail-icon" />,
  AlertCircle: () => <span data-testid="alert-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: (date: Date, formatStr: string) => {
    if (formatStr === 'dd MMM yyyy, HH:mm') {
      return '22 Dec 2024, 10:30';
    }
    return date.toISOString();
  },
}));

describe('SendHistory', () => {
  const mockLetterId = 'letter-123';

  const createMockHistory = (overrides: Partial<Parameters<typeof SendHistory>[0]['history'][0]> = {}) => ({
    id: 'send-1',
    recipientName: 'Dr. John Smith',
    recipientEmail: 'dr.smith@example.com',
    recipientType: 'GP' as const,
    channel: 'EMAIL',
    subject: 'Patient Letter',
    status: 'SENT' as const,
    queuedAt: '2024-12-22T10:00:00Z',
    sentAt: '2024-12-22T10:30:00Z',
    failedAt: null,
    errorMessage: null,
    ...overrides,
  });

  describe('Empty state', () => {
    it('displays empty state when no history', () => {
      render(<SendHistory letterId={mockLetterId} history={[]} />);

      expect(screen.getByText('This letter has not been sent yet.')).toBeInTheDocument();
      expect(screen.getByTestId('send-icon')).toBeInTheDocument();
    });

    it('does not show retry button in empty state', () => {
      render(<SendHistory letterId={mockLetterId} history={[]} onRetry={jest.fn()} />);

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
        createMockHistory({ id: '1', recipientType: 'REFERRER' }),
        createMockHistory({ id: '2', recipientType: 'SPECIALIST' }),
        createMockHistory({ id: '3', recipientType: 'OTHER' }),
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
      // Should not have a type badge
      expect(screen.queryByText('GP')).not.toBeInTheDocument();
    });
  });

  describe('Status display', () => {
    it('shows SENT status with check icon', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'SENT' })]}
        />
      );

      expect(screen.getByText('SENT')).toBeInTheDocument();
      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    });

    it('shows FAILED status with x icon', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' })]}
        />
      );

      expect(screen.getByText('FAILED')).toBeInTheDocument();
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });

    it('shows QUEUED status with clock icon', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'QUEUED' })]}
        />
      );

      expect(screen.getByText('QUEUED')).toBeInTheDocument();
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('shows SENDING status with clock icon', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'SENDING' })]}
        />
      );

      expect(screen.getByText('SENDING')).toBeInTheDocument();
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('shows BOUNCED status with x icon', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'BOUNCED' })]}
        />
      );

      expect(screen.getByText('BOUNCED')).toBeInTheDocument();
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });
  });

  describe('Error display', () => {
    it('displays error message for failed sends', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[
            createMockHistory({
              status: 'FAILED',
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
              status: 'FAILED',
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
          history={[createMockHistory({ status: 'FAILED' })]}
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
          history={[createMockHistory({ status: 'FAILED' })]}
          onRetry={jest.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('does not show retry button when onRetry not provided', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' })]}
        />
      );

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('does not show retry button for successful sends', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'SENT' })]}
          onRetry={jest.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('calls onRetry with sendId when retry clicked', async () => {
      const mockRetry = jest.fn().mockResolvedValue(undefined);
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ id: 'send-123', status: 'FAILED' })]}
          onRetry={mockRetry}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(mockRetry).toHaveBeenCalledWith('send-123');
      });
    });

    it('shows loading state during retry', async () => {
      const mockRetry = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' })]}
          onRetry={mockRetry}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('disables retry button during retry', async () => {
      const mockRetry = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' })]}
          onRetry={mockRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(retryButton).toBeDisabled();
    });

    it('shows error message when retry fails', async () => {
      const mockRetry = jest.fn().mockRejectedValue(new Error('Retry failed'));
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' })]}
          onRetry={mockRetry}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText('Retry failed')).toBeInTheDocument();
      });
    });

    it('shows generic error for non-Error rejections', async () => {
      const mockRetry = jest.fn().mockRejectedValue('Unknown error');
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'FAILED' })]}
          onRetry={mockRetry}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText('Retry failed')).toBeInTheDocument();
      });
    });
  });

  describe('Timestamp display', () => {
    it('shows sent timestamp for successful sends', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[createMockHistory({ status: 'SENT', sentAt: '2024-12-22T10:30:00Z' })]}
        />
      );

      expect(screen.getByText('22 Dec 2024, 10:30')).toBeInTheDocument();
    });

    it('shows failed timestamp for failed sends', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[
            createMockHistory({
              status: 'FAILED',
              sentAt: null,
              failedAt: '2024-12-22T10:35:00Z',
            }),
          ]}
        />
      );

      expect(screen.getByText('22 Dec 2024, 10:30')).toBeInTheDocument();
    });

    it('shows queued timestamp for queued sends', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[
            createMockHistory({
              status: 'QUEUED',
              sentAt: null,
              queuedAt: '2024-12-22T10:00:00Z',
            }),
          ]}
        />
      );

      expect(screen.getByText('22 Dec 2024, 10:30')).toBeInTheDocument();
    });

    it('shows dash for null timestamp', () => {
      render(
        <SendHistory
          letterId={mockLetterId}
          history={[
            createMockHistory({
              status: 'QUEUED',
              sentAt: null,
              failedAt: null,
              queuedAt: null as unknown as string,
            }),
          ]}
        />
      );

      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('Multiple sends', () => {
    it('renders multiple send items', () => {
      const history = [
        createMockHistory({ id: '1', recipientName: 'Dr. Smith', status: 'SENT' }),
        createMockHistory({ id: '2', recipientName: 'Dr. Jones', status: 'FAILED' }),
        createMockHistory({ id: '3', recipientName: 'Dr. Wilson', status: 'QUEUED' }),
      ];

      render(<SendHistory letterId={mockLetterId} history={history} />);

      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
      expect(screen.getByText('Dr. Jones')).toBeInTheDocument();
      expect(screen.getByText('Dr. Wilson')).toBeInTheDocument();
      expect(screen.getByText('3 sends')).toBeInTheDocument();
    });

    it('only shows retry for failed sends in mixed list', () => {
      const history = [
        createMockHistory({ id: '1', status: 'SENT' }),
        createMockHistory({ id: '2', status: 'FAILED' }),
        createMockHistory({ id: '3', status: 'QUEUED' }),
      ];

      render(<SendHistory letterId={mockLetterId} history={history} onRetry={jest.fn()} />);

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
