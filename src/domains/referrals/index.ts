// src/domains/referrals/index.ts
// Referral document domain exports
//
// IMPORTANT: This barrel export is used by client components.
// Server-only modules (referral.service, referral-extraction.service) are NOT
// re-exported here because they use Node.js-only dependencies (pdf-parse).
//
// Server-side code (API routes) should import directly:
//   import { extractTextFromDocument } from '@/domains/referrals/referral.service';
//   import { extractStructuredData } from '@/domains/referrals/referral-extraction.service';

// Client-safe types and utilities only
export * from './referral.types';
