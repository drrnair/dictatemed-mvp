// src/infrastructure/email/index.ts
// Public API for email infrastructure

export * from './types';
export * from './validation';
export { SESEmailAdapter, getSESAdapter } from './ses.adapter';

import type { EmailAdapter } from './types';
import { getSESAdapter } from './ses.adapter';

/**
 * Get the configured email adapter
 * Currently uses AWS SES, but can be extended to support other providers
 */
export function getEmailAdapter(): EmailAdapter {
  // Future: could check env var to select different providers
  // const provider = process.env.EMAIL_PROVIDER || 'ses';
  // switch (provider) {
  //   case 'sendgrid': return getSendGridAdapter();
  //   case 'smtp': return getSMTPAdapter();
  //   default: return getSESAdapter();
  // }
  return getSESAdapter();
}
