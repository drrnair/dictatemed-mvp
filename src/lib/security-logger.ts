// src/lib/security-logger.ts
// Security Event Logger
//
// This module provides specialized logging for security-related events.
// It integrates with Sentry for alerting and provides structured logging
// for security audit trails.
//
// Usage:
//   import { securityLogger } from '@/lib/security-logger';
//
//   // Log authentication events
//   securityLogger.authEvent('login_success', { userId: 'xxx', method: 'auth0' });
//   securityLogger.authEvent('login_failure', { email: 'xxx', reason: 'invalid_credentials' });
//
//   // Log authorization failures
//   securityLogger.authzFailure('letter', 'xxx-letter-id', { userId: 'yyy', action: 'read' });
//
//   // Log rate limit events
//   securityLogger.rateLimit({ key: 'xxx', limit: 100, windowMs: 60000 });
//
//   // Log suspicious activity
//   securityLogger.suspicious('repeated_failed_logins', { email: 'xxx', count: 5 });

import * as Sentry from '@sentry/nextjs';
import { logger } from './logger';
import { scrubObjectPHI, truncatePHI, isSensitiveKey } from './phi-scrubber';

/**
 * Security event severity levels.
 */
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security event types.
 */
export type SecurityEventType =
  | 'auth_login_success'
  | 'auth_login_failure'
  | 'auth_logout'
  | 'auth_token_refresh'
  | 'auth_session_expired'
  | 'authz_denied'
  | 'authz_resource_access'
  | 'rate_limit_exceeded'
  | 'rate_limit_warning'
  | 'suspicious_activity'
  | 'phi_access'
  | 'phi_export'
  | 'config_violation'
  | 'input_validation_failure'
  | 'csrf_failure'
  | 'csp_violation';

/**
 * Base context for all security events.
 */
interface SecurityEventContext {
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

/**
 * Authentication event context.
 */
interface AuthEventContext extends SecurityEventContext {
  email?: string;
  method?: string;
  reason?: string;
}

/**
 * Authorization failure context.
 */
interface AuthzFailureContext extends SecurityEventContext {
  resourceType: string;
  resourceId?: string;
  action?: string;
  ownerId?: string;
}

/**
 * Rate limit event context.
 */
interface RateLimitContext extends SecurityEventContext {
  key: string;
  limit: number;
  windowMs: number;
  current?: number;
}

/**
 * Suspicious activity context.
 */
interface SuspiciousContext extends SecurityEventContext {
  activityType: string;
  details?: string;
  count?: number;
}

/**
 * PHI access context.
 */
interface PHIAccessContext extends SecurityEventContext {
  resourceType: string;
  resourceId: string;
  action: 'read' | 'create' | 'update' | 'delete' | 'export';
  patientId?: string;
}

/**
 * Determine if an event should be sent to Sentry based on severity.
 */
function shouldSendToSentry(severity: SecuritySeverity): boolean {
  return severity === 'high' || severity === 'critical';
}

/**
 * Map severity to Sentry level.
 */
function severityToSentryLevel(
  severity: SecuritySeverity
): 'info' | 'warning' | 'error' | 'fatal' {
  switch (severity) {
    case 'low':
      return 'info';
    case 'medium':
      return 'warning';
    case 'high':
      return 'error';
    case 'critical':
      return 'fatal';
    default:
      return 'warning';
  }
}

/**
 * Scrub sensitive data from context before logging.
 * Prevents PHI from appearing in logs.
 * Uses shared PHI scrubber with additional truncation for long strings.
 */
function scrubContext(context: Record<string, unknown>): Record<string, unknown> {
  // First apply standard PHI scrubbing
  const scrubbed = scrubObjectPHI(context);

  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 100) {
      // Truncate long strings that might contain PHI
      scrubbed[key] = value.substring(0, 50) + '...[TRUNCATED]';
    } else {
      scrubbed[key] = value;
    }
  }

  return scrubbed;
}

/**
 * Core security event logging function.
 */
function logSecurityEvent(
  eventType: SecurityEventType,
  severity: SecuritySeverity,
  message: string,
  context: SecurityEventContext = {}
): void {
  const scrubbedContext = scrubContext(context);

  // Always log to structured logger
  const logContext = {
    securityEvent: eventType,
    severity,
    ...scrubbedContext,
  };

  switch (severity) {
    case 'critical':
    case 'high':
      logger.error(`[SECURITY] ${message}`, logContext);
      break;
    case 'medium':
      logger.warn(`[SECURITY] ${message}`, logContext);
      break;
    case 'low':
    default:
      logger.info(`[SECURITY] ${message}`, logContext);
  }

  // Send high/critical events to Sentry
  if (shouldSendToSentry(severity)) {
    Sentry.captureMessage(`[SECURITY] ${message}`, {
      level: severityToSentryLevel(severity),
      tags: {
        securityEvent: eventType,
        severity,
      },
      extra: scrubbedContext,
    });
  }
}

/**
 * Security Logger API.
 */
export const securityLogger = {
  /**
   * Log authentication events (login, logout, token refresh).
   */
  authEvent(
    event: 'login_success' | 'login_failure' | 'logout' | 'token_refresh' | 'session_expired',
    context: AuthEventContext = {}
  ): void {
    const eventTypeMap: Record<string, SecurityEventType> = {
      login_success: 'auth_login_success',
      login_failure: 'auth_login_failure',
      logout: 'auth_logout',
      token_refresh: 'auth_token_refresh',
      session_expired: 'auth_session_expired',
    };

    const severity: SecuritySeverity = event === 'login_failure' ? 'medium' : 'low';
    const message =
      event === 'login_failure'
        ? `Login failed: ${context.reason || 'unknown reason'}`
        : `Auth event: ${event}`;

    logSecurityEvent(eventTypeMap[event] || 'auth_login_success', severity, message, context);
  },

  /**
   * Log authorization failures (access denied).
   */
  authzFailure(
    resourceType: string,
    resourceId: string | undefined,
    context: Omit<AuthzFailureContext, 'resourceType' | 'resourceId'> = {}
  ): void {
    logSecurityEvent(
      'authz_denied',
      'medium',
      `Authorization denied for ${resourceType}${resourceId ? ` ${resourceId}` : ''}`,
      { resourceType, resourceId, ...context }
    );
  },

  /**
   * Log rate limit events.
   */
  rateLimit(context: RateLimitContext): void {
    const severity: SecuritySeverity = context.current && context.current > context.limit * 2 ? 'high' : 'medium';
    logSecurityEvent(
      'rate_limit_exceeded',
      severity,
      `Rate limit exceeded for ${context.key}`,
      context
    );
  },

  /**
   * Log suspicious activity.
   */
  suspicious(activityType: string, context: Omit<SuspiciousContext, 'activityType'> = {}): void {
    logSecurityEvent(
      'suspicious_activity',
      'high',
      `Suspicious activity detected: ${activityType}`,
      { activityType, ...context }
    );
  },

  /**
   * Log PHI access for audit trail.
   */
  phiAccess(context: PHIAccessContext): void {
    logSecurityEvent(
      context.action === 'export' ? 'phi_export' : 'phi_access',
      context.action === 'export' ? 'medium' : 'low',
      `PHI ${context.action}: ${context.resourceType} ${context.resourceId}`,
      context
    );
  },

  /**
   * Log configuration violations (e.g., dangerous env vars).
   */
  configViolation(message: string, context: SecurityEventContext = {}): void {
    logSecurityEvent('config_violation', 'critical', message, context);
  },

  /**
   * Log input validation failures.
   */
  inputValidation(
    path: string,
    details: string,
    context: SecurityEventContext = {}
  ): void {
    logSecurityEvent(
      'input_validation_failure',
      'low',
      `Input validation failed at ${path}: ${details}`,
      { path, details, ...context }
    );
  },

  /**
   * Log CSP violations.
   */
  cspViolation(
    directive: string,
    blockedUri: string,
    context: SecurityEventContext = {}
  ): void {
    logSecurityEvent(
      'csp_violation',
      'medium',
      `CSP violation: ${directive} blocked ${blockedUri}`,
      { directive, blockedUri, ...context }
    );
  },

  /**
   * Log custom security events.
   */
  custom(
    eventType: SecurityEventType,
    severity: SecuritySeverity,
    message: string,
    context: SecurityEventContext = {}
  ): void {
    logSecurityEvent(eventType, severity, message, context);
  },
};

// Export types for consumers
export type { SecurityEventContext, AuthEventContext, AuthzFailureContext, RateLimitContext, SuspiciousContext, PHIAccessContext };
