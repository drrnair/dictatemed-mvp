// src/infrastructure/email/resend.client.ts
// Resend email client configuration

import { Resend } from 'resend';

// Resend client singleton
let resendClientInstance: Resend | null = null;

/**
 * Validates that required Resend environment variables are set.
 * @throws Error if any required variable is missing
 */
function validateEnvironment(): { apiKey: string; fromEmail: string } {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is required');
  }

  if (!fromEmail) {
    throw new Error('RESEND_FROM_EMAIL environment variable is required');
  }

  return { apiKey, fromEmail };
}

/**
 * Get the Resend client instance.
 * Uses singleton pattern to avoid creating multiple instances.
 *
 * @returns Configured Resend client
 * @throws Error if environment variables are not set
 */
export function getResendClient(): Resend {
  if (resendClientInstance) {
    return resendClientInstance;
  }

  const { apiKey } = validateEnvironment();
  resendClientInstance = new Resend(apiKey);

  return resendClientInstance;
}

/**
 * Get the configured sender email address.
 * This should be a verified email in the Resend dashboard.
 *
 * @returns The sender email address
 * @throws Error if environment variable is not set
 */
export function getSenderEmail(): string {
  const { fromEmail } = validateEnvironment();
  return fromEmail;
}

/**
 * Check if Resend is configured.
 * Useful for conditional logic where email is optional.
 *
 * @returns true if Resend is properly configured
 */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/**
 * Validates Resend connectivity by making a test API call.
 * Call this during application startup to fail fast if Resend is misconfigured.
 *
 * @throws Error if Resend connection fails
 */
export async function validateResendConnection(): Promise<void> {
  try {
    const client = getResendClient();

    // Check API key validity by fetching domains (lightweight call)
    const { error } = await client.domains.list();

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Resend validation failed: ${message}`);
  }
}

// Re-export Resend types for convenience
export { Resend };
