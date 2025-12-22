// tests/unit/components/ThemeSettings.test.tsx
// Unit tests for ThemeSettings component

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { ThemeSettings } from '@/components/settings/ThemeSettings';

// Mock fetch
const mockFetch = vi.fn();

// Wrapper with ThemeProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}

describe('ThemeSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;

    // Reset localStorage
    localStorage.clear();

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ themePreference: 'system' }),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render loading state initially', () => {
    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    expect(screen.getByText('Loading theme settings...')).toBeInTheDocument();
  });

  it('should render theme options after loading', async () => {
    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Light')).toBeInTheDocument();
    });
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should display theme option descriptions', async () => {
    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('A bright theme for daytime use')).toBeInTheDocument();
    });
    expect(screen.getByText('Easier on the eyes in low light')).toBeInTheDocument();
    expect(screen.getByText('Automatically match your device settings')).toBeInTheDocument();
  });

  it('should fetch theme preference on mount', async () => {
    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/user/settings/theme');
    });
  });

  it('should update theme when clicking light option', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themePreference: 'system' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themePreference: 'light' }),
      });

    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    const lightButton = screen.getByText('Light').closest('button');
    fireEvent.click(lightButton!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/user/settings/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themePreference: 'light' }),
      });
    });
  });

  it('should update theme when clicking dark option', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themePreference: 'system' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themePreference: 'dark' }),
      });

    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Dark')).toBeInTheDocument();
    });

    const darkButton = screen.getByText('Dark').closest('button');
    fireEvent.click(darkButton!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/user/settings/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themePreference: 'dark' }),
      });
    });
  });

  it('should update theme when clicking system option', async () => {
    // Set initial theme to dark
    localStorage.setItem('dictatemed-theme', 'dark');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themePreference: 'dark' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themePreference: 'system' }),
      });

    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    const systemButton = screen.getByText('System').closest('button');
    fireEvent.click(systemButton!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/user/settings/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themePreference: 'system' }),
      });
    });
  });

  it('should show saving indicator during save', async () => {
    let resolveSecondFetch: (value: unknown) => void;
    const secondFetchPromise = new Promise((resolve) => {
      resolveSecondFetch = resolve;
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themePreference: 'system' }),
      })
      .mockReturnValueOnce(secondFetchPromise);

    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Dark')).toBeInTheDocument();
    });

    const darkButton = screen.getByText('Dark').closest('button');
    fireEvent.click(darkButton!);

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    // Clean up
    resolveSecondFetch!({
      ok: true,
      json: () => Promise.resolve({ themePreference: 'dark' }),
    });
  });

  it('should call PUT API when theme is changed', async () => {
    // This test verifies that clicking a theme option triggers the PUT API call
    // The error handling is tested through the integration tests
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themePreference: 'system' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themePreference: 'light' }),
      });

    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    const lightButton = screen.getByText('Light').closest('button');
    fireEvent.click(lightButton!);

    // Verify the PUT API was called
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/user/settings/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themePreference: 'light' }),
      });
    });
  });

  it('should disable buttons while saving', async () => {
    let resolveSecondFetch: (value: unknown) => void;
    const secondFetchPromise = new Promise((resolve) => {
      resolveSecondFetch = resolve;
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themePreference: 'system' }),
      })
      .mockReturnValueOnce(secondFetchPromise);

    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Dark')).toBeInTheDocument();
    });

    const darkButton = screen.getByText('Dark').closest('button');
    fireEvent.click(darkButton!);

    await waitFor(() => {
      const lightButton = screen.getByText('Light').closest('button');
      expect(lightButton).toBeDisabled();
    });

    // Clean up
    resolveSecondFetch!({
      ok: true,
      json: () => Promise.resolve({ themePreference: 'dark' }),
    });
  });

  it('should handle fetch error on load gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    // Should still render the UI even if fetch fails
    await waitFor(() => {
      expect(screen.getByText('Light')).toBeInTheDocument();
    });
  });

  it('should render card with correct title', async () => {
    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Theme')).toBeInTheDocument();
    });
  });

  it('should render card with description', async () => {
    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Select your preferred color scheme/)).toBeInTheDocument();
    });
  });

  it('should show currently resolved theme when system is selected', async () => {
    render(
      <TestWrapper>
        <ThemeSettings />
      </TestWrapper>
    );

    await waitFor(() => {
      // With system preference and matchMedia returning false (light), should show light
      expect(screen.getByText(/Currently showing: light/)).toBeInTheDocument();
    });
  });
});
