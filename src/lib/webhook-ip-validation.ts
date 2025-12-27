// src/lib/webhook-ip-validation.ts
// Webhook IP Allowlisting
//
// Validates that incoming webhook requests originate from known service IPs.
// This is a defense-in-depth measure used alongside signature verification.
//
// Security approach:
// - Resend: Published static IPs (required in production)
// - Deepgram: No static IPs published, relies on HMAC signature verification
//   We allow configurable IPs or skip IP check (signature is primary security)
//
// IPv6 Note:
// - Resend also publishes an IPv6 range (2600:1f24:64:8000::/52)
// - This module only supports IPv4 validation for simplicity
// - IPv6 addresses will fail validation unless added via RESEND_WEBHOOK_IPS env var
// - Most cloud providers (including Vercel) report IPv4 in x-forwarded-for headers
// - If you receive IPv6 webhooks, add the range to RESEND_WEBHOOK_IPS env var
//
// Usage:
//   import { validateWebhookIP } from '@/lib/webhook-ip-validation';
//   const result = validateWebhookIP(request, 'resend');
//   if (!result.allowed) {
//     return Response.json({ error: 'Forbidden' }, { status: 403 });
//   }

import { NextRequest } from 'next/server';
import { securityLogger } from './security-logger';
import { logger } from './logger';

/**
 * Known Resend webhook IPv4 addresses.
 * Source: https://resend.com/docs/dashboard/webhooks/introduction
 * Last verified: 2025-01
 *
 * Note: Resend also publishes IPv6 range 2600:1f24:64:8000::/52
 * which is not included here (IPv4 only implementation).
 * Use RESEND_WEBHOOK_IPS env var to add IPv6 support if needed.
 */
const RESEND_WEBHOOK_IPS = [
  '44.228.126.217',
  '50.112.21.217',
  '52.24.126.164',
  '54.148.139.208',
];

/**
 * Webhook service types.
 */
export type WebhookService = 'deepgram' | 'resend';

/**
 * Result of IP validation.
 */
export interface WebhookIPValidationResult {
  allowed: boolean;
  ip: string;
  service: WebhookService;
  reason?: string;
}

/**
 * Extract client IP from request headers.
 * Handles common proxy headers in order of preference.
 */
export function getClientIP(request: NextRequest): string {
  // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2, ...)
  // The first IP is the original client
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0]?.trim();
    if (firstIP) {
      return firstIP;
    }
  }

  // Vercel-specific header
  const vercelIP = request.headers.get('x-vercel-forwarded-for');
  if (vercelIP) {
    return vercelIP.split(',')[0]?.trim() || 'unknown';
  }

  // Real IP header (nginx, etc.)
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Cloudflare
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }

  return 'unknown';
}

/**
 * Check if an IP address is in a CIDR range.
 * Supports IPv4 only. IPv6 addresses will return false.
 *
 * @param ip - The IP address to check
 * @param cidr - Either an exact IP or CIDR notation (e.g., "192.168.1.0/24")
 * @returns true if the IP is in the range, false otherwise
 */
function ipInCIDR(ip: string, cidr: string): boolean {
  try {
    // Check if it's a CIDR range
    if (!cidr.includes('/')) {
      return ip === cidr;
    }

    const parts = cidr.split('/');
    const range = parts[0];
    const bits = parts[1];

    if (!range || !bits) {
      return false;
    }

    const mask = parseInt(bits, 10);

    if (isNaN(mask) || mask < 0 || mask > 32) {
      return false;
    }

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    if (ipNum === null || rangeNum === null) {
      return false;
    }

    const maskNum = ~((1 << (32 - mask)) - 1);
    return (ipNum & maskNum) === (rangeNum & maskNum);
  } catch {
    // Defensive: any parsing error means no match
    return false;
  }
}

/**
 * Convert IPv4 address to number.
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }

  let result = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      return null;
    }
    result = (result << 8) + num;
  }

  return result >>> 0; // Ensure unsigned
}

// Track whether we've logged custom IP configuration (log only once per service)
const customIPsLogged: Record<WebhookService, boolean> = {
  resend: false,
  deepgram: false,
};

/**
 * Get allowed IPs for a webhook service.
 * Logs once when custom overrides are first detected.
 */
function getAllowedIPs(service: WebhookService): string[] {
  switch (service) {
    case 'resend': {
      // Use env var override if set, otherwise use known IPs
      const resendOverride = process.env.RESEND_WEBHOOK_IPS;
      if (resendOverride) {
        const customIPs = resendOverride.split(',').map((ip) => ip.trim());
        // Log only once to avoid flooding logs on every request
        if (!customIPsLogged.resend) {
          logger.info('Using custom Resend webhook IPs from RESEND_WEBHOOK_IPS env var', {
            count: customIPs.length,
          });
          customIPsLogged.resend = true;
        }
        return customIPs;
      }
      return RESEND_WEBHOOK_IPS;
    }

    case 'deepgram': {
      // Deepgram doesn't publish static IPs
      // Allow configurable IPs via env var, or empty (skip IP check)
      const deepgramIPs = process.env.DEEPGRAM_WEBHOOK_IPS;
      if (deepgramIPs) {
        const customIPs = deepgramIPs.split(',').map((ip) => ip.trim());
        // Log only once to avoid flooding logs on every request
        if (!customIPsLogged.deepgram) {
          logger.info('Using custom Deepgram webhook IPs from DEEPGRAM_WEBHOOK_IPS env var', {
            count: customIPs.length,
          });
          customIPsLogged.deepgram = true;
        }
        return customIPs;
      }
      // Return empty - IP check will be skipped, signature is primary security
      return [];
    }

    default:
      return [];
  }
}

/**
 * Check if IP validation is enabled for a service.
 */
function isIPValidationEnabled(service: WebhookService): boolean {
  switch (service) {
    case 'resend':
      // Resend IP validation is always enabled (they publish static IPs)
      return true;

    case 'deepgram':
      // Deepgram IP validation only if IPs are configured
      // Signature verification is the primary security mechanism
      return Boolean(process.env.DEEPGRAM_WEBHOOK_IPS);

    default:
      return false;
  }
}

/**
 * Validate that a webhook request comes from an allowed IP.
 *
 * @param request - The incoming request
 * @param service - The webhook service (deepgram, resend)
 * @returns Validation result with allowed status and metadata
 */
export function validateWebhookIP(
  request: NextRequest,
  service: WebhookService
): WebhookIPValidationResult {
  const ip = getClientIP(request);
  const isProduction = process.env.NODE_ENV === 'production';

  // Check if IP validation is enabled for this service
  if (!isIPValidationEnabled(service)) {
    return {
      allowed: true,
      ip,
      service,
      reason: `IP validation not enabled for ${service} (using signature verification)`,
    };
  }

  const allowedIPs = getAllowedIPs(service);

  // Check if IP is in allowlist
  const isAllowed = allowedIPs.some((allowedIP) => {
    return ipInCIDR(ip, allowedIP);
  });

  if (isAllowed) {
    return {
      allowed: true,
      ip,
      service,
    };
  }

  // IP not in allowlist
  const result: WebhookIPValidationResult = {
    allowed: false,
    ip,
    service,
    reason: `IP ${ip} not in ${service} allowlist`,
  };

  // In development, log warning but allow
  if (!isProduction) {
    securityLogger.custom(
      'suspicious_activity',
      'low',
      `Webhook IP not in allowlist (allowing in dev): ${service}`,
      {
        ip,
        service,
        path: request.nextUrl.pathname,
      }
    );
    return {
      ...result,
      allowed: true,
      reason: `IP not in allowlist but allowed in development`,
    };
  }

  // In production, block and log
  securityLogger.suspicious('webhook_ip_blocked', {
    ip,
    path: request.nextUrl.pathname,
    details: `Request to ${service} webhook from unauthorized IP: ${ip}`,
  });

  return result;
}

/**
 * Middleware helper to validate webhook IP and return appropriate response.
 * Returns null if allowed, or a Response if blocked.
 */
export function validateWebhookIPMiddleware(
  request: NextRequest,
  service: WebhookService
): Response | null {
  const result = validateWebhookIP(request, service);

  if (result.allowed) {
    return null;
  }

  return new Response(
    JSON.stringify({
      error: 'Forbidden',
      message: 'Request origin not authorized',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Reset the custom IPs logged state.
 * Only exposed for testing purposes.
 * @internal
 */
export function _resetCustomIPsLogged(): void {
  customIPsLogged.resend = false;
  customIPsLogged.deepgram = false;
}
