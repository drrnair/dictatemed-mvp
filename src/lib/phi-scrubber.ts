// src/lib/phi-scrubber.ts
// Centralized PHI (Protected Health Information) Scrubbing
//
// This module provides utilities for removing PHI from strings, objects, and URLs
// before they are sent to external services like Sentry or logged.
//
// CRITICAL: This is a security-critical module. Changes should be reviewed carefully.
//
// Usage:
//   import { scrubPHI, scrubObjectPHI, scrubURLPHI } from '@/lib/phi-scrubber';
//
//   const safeMessage = scrubPHI(errorMessage);
//   const safeContext = scrubObjectPHI(context);
//   const safeUrl = scrubURLPHI(url);

/**
 * Keys that should always be completely redacted in objects.
 * These are field names commonly associated with PHI.
 */
export const SENSITIVE_KEYS = [
  'patient',
  'name',
  'firstName',
  'lastName',
  'email',
  'phone',
  'phoneNumber',
  'mobile',
  'dob',
  'dateOfBirth',
  'birthDate',
  'medicare',
  'medicareNumber',
  'address',
  'streetAddress',
  'encryptedData',
  'phi',
  'transcript',
  'transcriptRaw',
  'content',
  'contentFinal',
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'ssn',
  'socialSecurity',
] as const;

/**
 * Scrub potential PHI from a string.
 *
 * Patterns detected and scrubbed:
 * - Medicare numbers (Australian format: NNNN NNNNN N)
 * - Australian phone numbers (+61 or 0X XXXX XXXX)
 * - Email addresses
 * - Date patterns (DD/MM/YYYY, MM-DD-YY, etc.)
 * - UUIDs (often used as patient/record IDs)
 *
 * @param text - The string to scrub
 * @returns The scrubbed string with PHI replaced by placeholders
 */
export function scrubPHI(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  return (
    text
      // Medicare numbers (Australian format: NNNN NNNNN N or similar patterns)
      .replace(/\b\d{4}\s?\d{5}\s?\d{1}\b/g, '[MEDICARE_REDACTED]')
      // Australian phone numbers (various formats)
      .replace(/\b(?:\+?61|0)[2-478](?:[\s.-]?\d){8}\b/g, '[PHONE_REDACTED]')
      // International phone numbers (general pattern)
      .replace(/\b\+\d{1,3}[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}\b/g, '[PHONE_REDACTED]')
      // Email addresses
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
      // Dates in various formats (DD/MM/YYYY, MM-DD-YY, YYYY-MM-DD, etc.)
      .replace(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g, '[DATE_REDACTED]')
      .replace(/\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g, '[DATE_REDACTED]')
      // UUIDs (often used as patient/record IDs)
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
        '[UUID_REDACTED]'
      )
      // JSON-like patient object patterns
      .replace(
        /"(patient|name|email|phone|dob|dateOfBirth|medicare|address)":\s*"[^"]*"/gi,
        '"$1":"[REDACTED]"'
      )
  );
}

/**
 * Check if a key name indicates sensitive data.
 *
 * @param key - The key name to check
 * @returns true if the key indicates sensitive data
 */
export function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some((k) => lowerKey.includes(k.toLowerCase()));
}

/**
 * Recursively scrub PHI from an object.
 *
 * - Keys matching SENSITIVE_KEYS are completely redacted
 * - String values are passed through scrubPHI()
 * - Objects are recursively processed
 * - Arrays are mapped with the same logic
 *
 * @param obj - The object to scrub
 * @param maxDepth - Maximum recursion depth (default 10, prevents infinite loops)
 * @returns A new object with PHI scrubbed
 */
export function scrubObjectPHI(
  obj: Record<string, unknown>,
  maxDepth: number = 10
): Record<string, unknown> {
  if (!obj || typeof obj !== 'object' || maxDepth <= 0) {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Completely redact values of sensitive keys
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      // Scrub string values
      result[key] = scrubPHI(value);
    } else if (Array.isArray(value)) {
      // Process arrays
      result[key] = value.map((item) => {
        if (typeof item === 'string') {
          return scrubPHI(item);
        } else if (typeof item === 'object' && item !== null) {
          return scrubObjectPHI(item as Record<string, unknown>, maxDepth - 1);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      // Recursively process nested objects
      result[key] = scrubObjectPHI(value as Record<string, unknown>, maxDepth - 1);
    } else {
      // Keep primitive values as-is
      result[key] = value;
    }
  }

  return result;
}

/**
 * Scrub PHI from URLs.
 *
 * - Replaces UUID path segments with placeholders
 * - Removes query parameters entirely
 *
 * @param url - The URL to scrub
 * @returns The scrubbed URL
 */
export function scrubURLPHI(url: string): string {
  if (!url || typeof url !== 'string') {
    return url;
  }

  return (
    url
      // Replace UUID path segments
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/[ID_REDACTED]'
      )
      // Remove query parameters entirely
      .replace(/\?.*$/, '?[PARAMS_REDACTED]')
  );
}

/**
 * Truncate long strings that might contain PHI.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length (default 100)
 * @returns Truncated string if over maxLength
 */
export function truncatePHI(text: string, maxLength: number = 100): string {
  if (!text || typeof text !== 'string' || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, Math.floor(maxLength / 2)) + '...[TRUNCATED]';
}
