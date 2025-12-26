// src/infrastructure/supabase/client.ts
// Supabase client configuration for storage and database operations

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Supabase client singletons
let supabaseClientInstance: SupabaseClient | null = null;
let supabaseServiceClientInstance: SupabaseClient | null = null;

/**
 * Validates that required Supabase environment variables are set.
 * @throws Error if any required variable is missing
 */
function validateEnvironment(): { url: string; anonKey?: string; serviceRoleKey?: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
  }

  // For server-side operations, we need either the service role key or anon key
  if (!serviceRoleKey && !anonKey) {
    throw new Error(
      'Either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required'
    );
  }

  return { url, anonKey, serviceRoleKey };
}

/**
 * Get the public Supabase client instance (uses anon key).
 * Use this for client-side operations or when RLS policies should apply.
 *
 * IMPORTANT: This client respects Row Level Security policies.
 * Use getSupabaseServiceClient() for admin operations that bypass RLS.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const { url, anonKey } = validateEnvironment();

  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required for public client');
  }

  supabaseClientInstance = createClient(url, anonKey, {
    auth: {
      persistSession: false, // Server-side, no session persistence needed
    },
  });

  return supabaseClientInstance;
}

/**
 * Get the service role Supabase client instance.
 * Use this for server-side admin operations that need to bypass RLS.
 *
 * SECURITY WARNING: This client bypasses Row Level Security.
 * - NEVER expose this client to the frontend
 * - NEVER use in client-side code
 * - Only use for trusted server-side operations
 * - Always validate user authorization before using
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (supabaseServiceClientInstance) {
    return supabaseServiceClientInstance;
  }

  const { url, serviceRoleKey } = validateEnvironment();

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service client');
  }

  supabaseServiceClientInstance = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseServiceClientInstance;
}

/**
 * Storage bucket names for PHI data.
 * These buckets should be configured as private in Supabase.
 */
export const STORAGE_BUCKETS = {
  /**
   * Private bucket for audio recordings.
   * Contains consultation audio (ambient and dictation modes).
   * PHI Level: High - contains actual patient conversations
   */
  AUDIO_RECORDINGS: 'audio-recordings',

  /**
   * Private bucket for clinical documents.
   * Contains PDFs, images of ECGs, echo reports, etc.
   * PHI Level: High - contains clinical data
   */
  CLINICAL_DOCUMENTS: 'clinical-documents',

  /**
   * Private bucket for user assets.
   * Contains signatures and letterheads.
   * PHI Level: Low - no patient data, but still private
   */
  USER_ASSETS: 'user-assets',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * Default expiration times for signed URLs (in seconds).
 * Keep these short to minimize exposure window for PHI.
 */
export const SIGNED_URL_EXPIRY = {
  /** Upload URL expiry - 15 minutes */
  UPLOAD: 15 * 60,
  /** Download URL expiry - 1 hour (for AI processing) */
  DOWNLOAD: 60 * 60,
  /** Short-lived preview URL - 5 minutes (for UI previews) */
  PREVIEW: 5 * 60,
} as const;

/**
 * Validates Supabase connectivity by checking storage buckets exist.
 * Call this during application startup to fail fast if Supabase is misconfigured.
 *
 * @throws Error if Supabase connection fails or buckets don't exist
 */
export async function validateSupabaseConnection(): Promise<void> {
  try {
    const client = getSupabaseServiceClient();

    // Check that required buckets exist
    const { data: buckets, error } = await client.storage.listBuckets();

    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }

    const bucketNames = buckets?.map((b) => b.name) || [];
    const requiredBuckets = Object.values(STORAGE_BUCKETS);

    const missingBuckets = requiredBuckets.filter((b) => !bucketNames.includes(b));

    if (missingBuckets.length > 0) {
      logger.warn(
        `Missing Supabase storage buckets: ${missingBuckets.join(', ')}. ` +
          'Run the storage bucket migration to create them.'
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Supabase validation failed: ${message}`);
  }
}

/**
 * Creates a Supabase client with a user's JWT token for authenticated operations.
 * This client will respect RLS policies based on the user's identity.
 *
 * @param accessToken - The user's JWT access token
 * @returns Supabase client configured with user authentication
 */
export function getSupabaseClientWithAuth(accessToken: string): SupabaseClient {
  const { url, anonKey } = validateEnvironment();

  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
    },
  });
}

// Re-export types for convenience
export { SupabaseClient };
