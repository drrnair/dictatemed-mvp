// src/app/api/letters/[id]/email/route.ts
// Endpoints for sending and tracking letter emails

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { sendLetterEmail, getLetterEmailHistory, isResendConfigured } from '@/infrastructure/email';
import { decryptPatientData } from '@/infrastructure/db/encryption';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface SendEmailRequestBody {
  recipientEmail: string;
  recipientName: string;
  ccEmails?: string[];
  pdfBase64: string;
  pdfFilename?: string;
}

/**
 * POST /api/letters/:id/email - Send an approved letter via email
 *
 * Request body:
 * {
 *   recipientEmail: string;       // Recipient email address
 *   recipientName: string;        // Recipient name (e.g., "Dr. John Smith")
 *   ccEmails?: string[];          // Optional CC recipients
 *   pdfBase64: string;            // PDF attachment as base64 string
 *   pdfFilename?: string;         // Optional filename (defaults to auto-generated)
 * }
 *
 * Response:
 * {
 *   id: string;                   // Sent email record ID
 *   messageId: string;            // Resend message ID
 *   status: 'sent';
 *   sentAt: Date;
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'sendLetterEmail' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: letterId } = await params;

    // Check if email is configured
    if (!isResendConfigured()) {
      return NextResponse.json(
        { error: 'Email service is not configured' },
        { status: 503 }
      );
    }

    // Check rate limit (10 emails per minute)
    const rateLimitKey = createRateLimitKey(userId, 'emails');
    const rateLimit = checkRateLimit(rateLimitKey, 'emails');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for email sending', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Parse request body
    const body = (await request.json()) as SendEmailRequestBody;

    // Validate required fields
    if (!body.recipientEmail || !isValidEmail(body.recipientEmail)) {
      return NextResponse.json(
        { error: 'Valid recipientEmail is required' },
        { status: 400 }
      );
    }

    if (!body.recipientName) {
      return NextResponse.json(
        { error: 'recipientName is required' },
        { status: 400 }
      );
    }

    if (!body.pdfBase64) {
      return NextResponse.json(
        { error: 'pdfBase64 is required' },
        { status: 400 }
      );
    }

    // Validate CC emails if provided
    if (body.ccEmails) {
      for (const email of body.ccEmails) {
        if (!isValidEmail(email)) {
          return NextResponse.json(
            { error: `Invalid CC email: ${email}` },
            { status: 400 }
          );
        }
      }
    }

    // Get the letter with related data
    const letter = await prisma.letter.findFirst({
      where: { id: letterId, userId },
      include: {
        user: {
          include: { practice: true },
        },
        patient: true,
        consultation: {
          include: { referrer: true },
        },
      },
    });

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    // Check if letter is approved
    if (letter.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved letters can be sent. Current status: ' + letter.status },
        { status: 400 }
      );
    }

    // Get patient identifier (minimal - just initials or MRN)
    let patientIdentifier = 'Patient';
    if (letter.patient) {
      try {
        // encryptedData is stored as a string in format iv:authTag:ciphertext
        const encryptedString = letter.patient.encryptedData as string;
        const decrypted = decryptPatientData(encryptedString);
        if (decrypted.name) {
          // Extract initials for minimal PHI in email subject
          const nameParts = decrypted.name.split(' ');
          patientIdentifier = nameParts.map((n: string) => n.charAt(0).toUpperCase()).join('');
        }
      } catch (e) {
        log.warn('Could not decrypt patient data for email', { letterId });
      }
    }

    // Format letter type
    const letterTypeDisplay = formatLetterType(letter.letterType);

    // Generate filename
    const filename = body.pdfFilename || generatePdfFilename(letterTypeDisplay, patientIdentifier, letter.createdAt);

    // Get content preview (first ~150 chars without PHI)
    const contentPreview = letter.contentFinal
      ? sanitizeContentPreview(letter.contentFinal)
      : undefined;

    // Send the email
    const result = await sendLetterEmail({
      letterId,
      userId,
      recipientEmail: body.recipientEmail,
      recipientName: body.recipientName,
      ccEmails: body.ccEmails,
      letterData: {
        recipientName: body.recipientName,
        senderName: letter.user.name,
        practiceName: letter.user.practice.name,
        patientIdentifier,
        letterType: letterTypeDisplay,
        consultationDate: formatDate(letter.createdAt),
        contentPreview,
      },
      pdfAttachment: body.pdfBase64,
      pdfFilename: filename,
    });

    log.info('Letter email sent', {
      letterId,
      emailId: result.id,
      messageId: result.messageId,
      userId,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: getRateLimitHeaders(rateLimit),
    });
  } catch (error) {
    log.error(
      'Failed to send letter email',
      {},
      error instanceof Error ? error : undefined
    );

    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/letters/:id/email - Get email sending history for a letter
 *
 * Response:
 * {
 *   emails: Array<{
 *     id: string;
 *     recipientEmail: string;
 *     recipientName: string;
 *     status: string;
 *     sentAt: Date | null;
 *     lastEventAt: Date | null;
 *   }>
 * }
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: letterId } = await params;

    // Verify user owns this letter
    const letter = await prisma.letter.findFirst({
      where: { id: letterId, userId },
      select: { id: true },
    });

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    const emails = await getLetterEmailHistory(userId, letterId);

    return NextResponse.json({ emails });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get email history' },
      { status: 500 }
    );
  }
}

// Helper functions

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function formatLetterType(type: string): string {
  const typeMap: Record<string, string> = {
    NEW_PATIENT: 'New Patient Consultation',
    FOLLOW_UP: 'Follow-Up Consultation',
    ANGIOGRAM_PROCEDURE: 'Angiogram Procedure Report',
    ECHO_REPORT: 'Echocardiogram Report',
  };
  return typeMap[type] || type.replace(/_/g, ' ');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function generatePdfFilename(letterType: string, patientId: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0];
  const safeLetterType = letterType.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeLetterType}_${patientId}_${dateStr}.pdf`;
}

function sanitizeContentPreview(content: string): string {
  // Remove any markup, extra whitespace, and limit length
  const cleaned = content
    .replace(/[#*_`]/g, '') // Remove markdown
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();

  // Take first 150 characters, ending at word boundary
  if (cleaned.length <= 150) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, 150);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}
