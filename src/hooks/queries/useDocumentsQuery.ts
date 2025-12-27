// src/hooks/queries/useDocumentsQuery.ts
// React Query hooks for document operations

'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';

// ============================================================================
// Types
// ============================================================================

export type DocumentType =
  | 'REFERRAL'
  | 'INVESTIGATION'
  | 'REPORT'
  | 'CORRESPONDENCE'
  | 'OTHER';

export type DocumentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED';

export interface Document {
  id: string;
  patientId: string | null;
  name: string;
  type: DocumentType;
  status: DocumentStatus;
  storagePath: string;
  extractedData: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentFilters {
  page?: number;
  limit?: number;
  type?: DocumentType;
  status?: DocumentStatus;
  patientId?: string;
}

export interface DocumentListResponse {
  documents: Document[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface UploadDocumentInput {
  patientId?: string;
  type: DocumentType;
  file: File;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchDocuments(
  filters: DocumentFilters
): Promise<DocumentListResponse> {
  const params = new URLSearchParams();

  if (filters.page) params.set('page', filters.page.toString());
  if (filters.limit) params.set('limit', filters.limit.toString());
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.patientId) params.set('patientId', filters.patientId);

  const response = await fetch(`/api/documents?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch documents');
  }

  return response.json();
}

async function fetchDocument(id: string): Promise<Document> {
  const response = await fetch(`/api/documents/${id}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch document');
  }

  return response.json();
}

async function uploadDocument(input: UploadDocumentInput): Promise<Document> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('type', input.type);
  if (input.patientId) {
    formData.append('patientId', input.patientId);
  }

  const response = await fetch('/api/documents', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to upload document');
  }

  return response.json();
}

async function processDocument(id: string): Promise<Document> {
  const response = await fetch(`/api/documents/${id}/process`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to process document');
  }

  return response.json();
}

async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/documents/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete document');
  }
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook for fetching documents list with filtering and pagination
 */
export function useDocumentsQuery(
  filters: DocumentFilters = {},
  options?: Omit<
    UseQueryOptions<DocumentListResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.documents.list(filters),
    queryFn: () => fetchDocuments(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

/**
 * Hook for fetching a single document by ID
 */
export function useDocumentQuery(
  id: string,
  options?: Omit<UseQueryOptions<Document, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.documents.detail(id),
    queryFn: () => fetchDocument(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook for polling a document until processing is complete
 */
export function useDocumentPollQuery(
  id: string,
  options?: Omit<UseQueryOptions<Document, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.documents.detail(id),
    queryFn: () => fetchDocument(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when document processing is complete
      if (data?.status === 'PROCESSED' || data?.status === 'FAILED') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for uploading a document
 */
export function useUploadDocumentMutation(
  options?: UseMutationOptions<Document, Error, UploadDocumentInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() });
    },
    ...options,
  });
}

// Context type for process document mutation
interface ProcessDocumentContext {
  previousDocument: Document | undefined;
}

/**
 * Hook for processing a document
 */
export function useProcessDocumentMutation(
  options?: Omit<
    UseMutationOptions<Document, Error, string, ProcessDocumentContext>,
    'mutationFn' | 'onMutate' | 'onError' | 'onSettled'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<Document, Error, string, ProcessDocumentContext>({
    mutationFn: processDocument,
    onMutate: async (documentId): Promise<ProcessDocumentContext> => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.documents.detail(documentId),
      });

      const previousDocument = queryClient.getQueryData<Document>(
        queryKeys.documents.detail(documentId)
      );

      if (previousDocument) {
        queryClient.setQueryData<Document>(
          queryKeys.documents.detail(documentId),
          { ...previousDocument, status: 'PROCESSING' }
        );
      }

      return { previousDocument };
    },
    onError: (_err, documentId, context) => {
      if (context?.previousDocument) {
        queryClient.setQueryData(
          queryKeys.documents.detail(documentId),
          context.previousDocument
        );
      }
    },
    onSettled: (_, __, documentId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.detail(documentId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() });
    },
    ...options,
  });
}

/**
 * Hook for deleting a document
 */
export function useDeleteDocumentMutation(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: (_, documentId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.documents.detail(documentId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() });
    },
    ...options,
  });
}
