// src/infrastructure/email/validation.ts
// Email validation utilities

/**
 * RFC 5322 compliant email regex (simplified for practical use)
 * Allows most valid email formats while rejecting obviously invalid ones
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Maximum length for email addresses (RFC 5321)
 */
const MAX_EMAIL_LENGTH = 254;

/**
 * Maximum length for local part (before @)
 */
const MAX_LOCAL_LENGTH = 64;

/**
 * Validate an email address format
 * @param email - Email address to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmed = email.trim().toLowerCase();

  // Check length limits
  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return false;
  }

  // Check local part length
  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1 || atIndex > MAX_LOCAL_LENGTH) {
    return false;
  }

  // Check against regex
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Normalize an email address (lowercase, trim)
 * @param email - Email address to normalize
 * @returns Normalized email address
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  return email.trim().toLowerCase();
}

/**
 * Extract domain from email address
 * @param email - Email address
 * @returns Domain part or null if invalid
 */
export function getEmailDomain(email: string): string | null {
  if (!isValidEmail(email)) {
    return null;
  }
  const parts = email.split('@');
  return parts[1]?.toLowerCase() || null;
}

/**
 * Check if email is from a known disposable email provider
 * This is a basic check - production should use a more comprehensive list
 */
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com',
  'throwaway.email',
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'temp-mail.org',
  'fakeinbox.com',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Validate multiple email addresses
 * @param emails - Array of email addresses
 * @returns Object with valid and invalid emails
 */
export function validateEmails(emails: string[]): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const email of emails) {
    if (isValidEmail(email)) {
      valid.push(normalizeEmail(email));
    } else {
      invalid.push(email);
    }
  }

  return { valid, invalid };
}

/**
 * Mask an email address for display (privacy)
 * john.doe@example.com -> j***e@example.com
 */
export function maskEmail(email: string): string {
  if (!isValidEmail(email)) {
    return email;
  }

  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return email;
  }

  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }

  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
