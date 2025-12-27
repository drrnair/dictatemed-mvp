// src/components/providers/QueryProvider.tsx
// React Query provider with DevTools for development

'use client';

import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/react-query';

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * QueryProvider wraps the application with React Query's QueryClientProvider
 * and includes DevTools in development for debugging queries
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Use getQueryClient to ensure we have a singleton on the client
  // and a new instance on each server request
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only in development - automatically excluded in production builds */}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
