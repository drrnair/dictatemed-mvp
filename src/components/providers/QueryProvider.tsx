// src/components/providers/QueryProvider.tsx
// React Query provider with DevTools for development

'use client';

import * as React from 'react';
import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/react-query';

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * QueryProvider wraps the application with React Query's QueryClientProvider
 * and includes DevTools in development for debugging queries
 *
 * Uses useState to ensure stable QueryClient reference across:
 * - React StrictMode double-renders in development
 * - SSR/hydration scenarios
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // useState ensures stable client reference across renders
  // getQueryClient() handles server vs client singleton logic
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only in development - automatically excluded in production builds */}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
