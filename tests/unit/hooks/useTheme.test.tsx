// tests/unit/hooks/useTheme.test.tsx
// Unit tests for useTheme hook

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { useTheme } from '@/hooks/useTheme';

// Wrap with ThemeProvider for testing
function wrapper({ children }: { children: React.ReactNode }) {
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

describe('useTheme', () => {
  beforeEach(() => {
    // Reset localStorage before each test
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
  });

  it('returns initial loading state', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
  });

  it('stops loading after mount', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('returns default preference as system', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preference).toBe('system');
    expect(result.current.isSystemPreference).toBe(true);
  });

  it('returns resolved theme', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should be light (since matchMedia returns false for dark)
    expect(result.current.theme).toBe('light');
  });

  it('setPreference updates theme', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setPreference('dark');
    });

    await waitFor(() => {
      expect(result.current.preference).toBe('dark');
    });

    expect(result.current.isSystemPreference).toBe(false);
  });

  it('toggleTheme switches between light and dark', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Get initial theme (light)
    const initialTheme = result.current.theme;
    expect(initialTheme).toBe('light');

    // Toggle should switch to dark
    act(() => {
      result.current.toggleTheme();
    });

    await waitFor(() => {
      expect(result.current.preference).toBe('dark');
    });
  });

  it('returns system theme', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // System theme should be light (mocked matchMedia returns false)
    expect(result.current.systemTheme).toBe('light');
  });

  it('setPreference to system enables isSystemPreference', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // First set to dark
    act(() => {
      result.current.setPreference('dark');
    });

    await waitFor(() => {
      expect(result.current.isSystemPreference).toBe(false);
    });

    // Then set back to system
    act(() => {
      result.current.setPreference('system');
    });

    await waitFor(() => {
      expect(result.current.isSystemPreference).toBe(true);
    });
  });
});
