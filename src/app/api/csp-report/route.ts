// src/app/api/csp-report/route.ts
// Content Security Policy violation reporting endpoint
//
// This endpoint receives CSP violation reports from browsers when
// Content-Security-Policy headers are violated. These reports help
// identify XSS attacks, misconfigurations, and third-party script issues.
//
// @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * CSP Violation Report structure
 * @see https://www.w3.org/TR/CSP3/#violation-events
 */
interface CSPViolationReport {
  'csp-report': {
    /** The URI of the resource that was blocked */
    'blocked-uri'?: string;
    /** The column number in the document at which the violation occurred */
    'column-number'?: number;
    /** The directive that was violated */
    'disposition'?: 'enforce' | 'report';
    /** The URI of the document in which the violation occurred */
    'document-uri'?: string;
    /** The effective directive that was violated */
    'effective-directive'?: string;
    /** The line number in the document at which the violation occurred */
    'line-number'?: number;
    /** The original policy as specified by the CSP header */
    'original-policy'?: string;
    /** The referrer of the document in which the violation occurred */
    'referrer'?: string;
    /** A sample of the inline script, event handler, or style that caused the violation */
    'script-sample'?: string;
    /** The HTTP status code of the resource on which the global object was instantiated */
    'status-code'?: number;
    /** The violated directive (deprecated, use effective-directive) */
    'violated-directive'?: string;
    /** The URI of the resource that violated the policy */
    'source-file'?: string;
  };
}

/**
 * Rate limiting for CSP reports (in-memory, per-instance)
 * Prevents DoS via report flooding
 *
 * Note: In serverless environments (Vercel), each instance has its own Map,
 * providing per-instance rate limiting. For stricter limits, use Redis.
 */
const reportCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REPORTS = 50; // Max reports per IP per minute
const CLEANUP_PROBABILITY = 0.05; // 5% chance to run cleanup on each request

/**
 * Periodically clean up expired rate limit entries to prevent memory growth.
 * Uses probabilistic cleanup to avoid running on every request.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  // Use forEach for TypeScript compatibility (avoids downlevelIteration requirement)
  reportCounts.forEach((record, ip) => {
    if (now > record.resetAt) {
      reportCounts.delete(ip);
    }
  });
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Probabilistic cleanup to prevent memory leak from stale entries
  if (Math.random() < CLEANUP_PROBABILITY) {
    cleanupExpiredEntries();
  }

  const record = reportCounts.get(ip);

  if (!record || now > record.resetAt) {
    reportCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  record.count++;
  return record.count > RATE_LIMIT_MAX_REPORTS;
}

/**
 * Handle CSP violation reports
 *
 * Browsers send reports as POST requests with Content-Type: application/csp-report
 * We log these for security monitoring and potential attack detection
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Rate limit check
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { received: false, reason: 'rate_limited' },
        { status: 429 }
      );
    }

    // Parse the CSP report
    const contentType = request.headers.get('content-type') || '';

    let report: CSPViolationReport | null = null;

    if (contentType.includes('application/csp-report') ||
        contentType.includes('application/json')) {
      report = await request.json() as CSPViolationReport;
    } else {
      // Some browsers send as text
      const text = await request.text();
      try {
        report = JSON.parse(text) as CSPViolationReport;
      } catch {
        logger.warn('CSP report: Invalid format', {
          action: 'csp_report_invalid',
          resource: 'csp',
          contentType,
        });
        return NextResponse.json(
          { received: false, reason: 'invalid_format' },
          { status: 400 }
        );
      }
    }

    const cspReport = report?.['csp-report'];

    if (!cspReport) {
      return NextResponse.json(
        { received: false, reason: 'missing_csp_report' },
        { status: 400 }
      );
    }

    // Determine severity based on the violation
    const blockedUri = cspReport['blocked-uri'] || '';
    const effectiveDirective = cspReport['effective-directive'] || '';
    const documentUri = cspReport['document-uri'] || '';

    // Filter out noise (browser extensions, common false positives)
    const isNoise =
      blockedUri.startsWith('chrome-extension://') ||
      blockedUri.startsWith('moz-extension://') ||
      blockedUri.startsWith('safari-extension://') ||
      blockedUri === 'about:blank' ||
      blockedUri === 'inline' ||
      blockedUri === 'eval';

    // Log the violation
    if (isNoise) {
      // Debug level for browser extension noise
      logger.debug('CSP violation (filtered)', {
        action: 'csp_violation_filtered',
        resource: 'csp',
        blockedUri: blockedUri.substring(0, 100), // Truncate for safety
        directive: effectiveDirective,
      });
    } else {
      // Warn level for real violations that need attention
      logger.warn('CSP violation detected', {
        action: 'csp_violation',
        resource: 'csp',
        blockedUri: blockedUri.substring(0, 200),
        documentUri: documentUri.substring(0, 200),
        directive: effectiveDirective,
        violatedDirective: cspReport['violated-directive'],
        sourceFile: cspReport['source-file']?.substring(0, 200),
        lineNumber: cspReport['line-number'],
        columnNumber: cspReport['column-number'],
        disposition: cspReport['disposition'],
        // Truncate script sample to avoid logging malicious content
        scriptSample: cspReport['script-sample']?.substring(0, 100),
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      'CSP report processing failed',
      {
        action: 'csp_report_error',
        resource: 'csp',
      },
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      { received: false, reason: 'internal_error' },
      { status: 500 }
    );
  }
}
