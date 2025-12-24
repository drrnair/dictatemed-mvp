// src/infrastructure/email/templates/letter.ts
// Email templates for sending consultation letters to referrers

/**
 * Data required to render the letter email template.
 */
export interface LetterEmailData {
  /** Recipient name (e.g., "Dr. John Smith") */
  recipientName: string;
  /** Sender/specialist name (e.g., "Dr. Sarah Johnson") */
  senderName: string;
  /** Practice name (e.g., "Sydney Cardiology") */
  practiceName: string;
  /** Patient identifier - minimal, no full name (e.g., initials or MRN) */
  patientIdentifier: string;
  /** Letter type for context (e.g., "Follow-Up Consultation") */
  letterType: string;
  /** Date of consultation */
  consultationDate: string;
  /** Brief preview of letter content (first 200 chars, no PHI) */
  contentPreview?: string;
}

/**
 * Generates the HTML email template for sending consultation letters.
 *
 * Design considerations:
 * - Minimal PHI in email body (full content in PDF attachment)
 * - Clear DictateMED attribution as AI-generated documentation
 * - Professional medico-legal disclaimer
 * - Mobile-friendly responsive design
 */
export function generateLetterEmailHtml(data: LetterEmailData): string {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Consultation Letter - ${data.practiceName}</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .fallback-font { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">

          <!-- Header -->
          <tr>
            <td style="background-color: #1e40af; padding: 30px 40px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                ${escapeHtml(data.practiceName)}
              </h1>
              <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 14px;">
                Consultation Letter
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Dear ${escapeHtml(data.recipientName)},
              </p>

              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Please find attached a ${escapeHtml(data.letterType.toLowerCase())} letter regarding your patient (${escapeHtml(data.patientIdentifier)}) following a consultation on ${escapeHtml(data.consultationDate)}.
              </p>

              ${data.contentPreview ? `
              <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 16px 20px; margin: 24px 0; border-radius: 0 4px 4px 0;">
                <p style="margin: 0; color: #6b7280; font-size: 14px; font-style: italic;">
                  "${escapeHtml(truncateText(data.contentPreview, 200))}..."
                </p>
              </div>
              ` : ''}

              <p style="margin: 24px 0 0 0; color: #374151; font-size: 16px; line-height: 1.6;">
                The complete letter is attached as a PDF document for your records.
              </p>

              <p style="margin: 24px 0 0 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Kind regards,<br>
                <strong>${escapeHtml(data.senderName)}</strong><br>
                <span style="color: #6b7280;">${escapeHtml(data.practiceName)}</span>
              </p>
            </td>
          </tr>

          <!-- AI Attribution Notice -->
          <tr>
            <td style="background-color: #fef3c7; padding: 16px 40px; border-top: 1px solid #fcd34d;">
              <p style="margin: 0; color: #92400e; font-size: 12px; line-height: 1.5;">
                <strong>Administrative Notice:</strong> This correspondence was generated using DictateMED,
                a clinical documentation tool. The content has been reviewed and approved by
                ${escapeHtml(data.senderName)} prior to dispatch.
              </p>
            </td>
          </tr>

          <!-- Confidentiality Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 11px; line-height: 1.5;">
                <strong>CONFIDENTIALITY NOTICE:</strong> This email and any attachments are intended solely
                for the addressee(s) and may contain confidential or legally privileged information.
                If you are not the intended recipient, you must not copy, distribute, or take any action
                in reliance on it. If you have received this email in error, please notify the sender
                immediately by reply email and delete the original message and any copies.
              </p>
              <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 11px; line-height: 1.5;">
                This communication may contain protected health information (PHI) subject to privacy
                regulations. Please handle accordingly.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                &copy; ${currentYear} ${escapeHtml(data.practiceName)}. Powered by
                <a href="https://dictatemed.com" style="color: #3b82f6; text-decoration: none;">DictateMED</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Generates the plain text email template for sending consultation letters.
 * Used as fallback for email clients that don't support HTML.
 */
export function generateLetterEmailText(data: LetterEmailData): string {
  const currentYear = new Date().getFullYear();

  return `
${data.practiceName}
Consultation Letter
${'='.repeat(50)}

Dear ${data.recipientName},

Please find attached a ${data.letterType.toLowerCase()} letter regarding your patient (${data.patientIdentifier}) following a consultation on ${data.consultationDate}.

${data.contentPreview ? `Preview:\n"${truncateText(data.contentPreview, 200)}..."\n` : ''}
The complete letter is attached as a PDF document for your records.

Kind regards,
${data.senderName}
${data.practiceName}

${'='.repeat(50)}
ADMINISTRATIVE NOTICE

This correspondence was generated using DictateMED, a clinical documentation tool. The content has been reviewed and approved by ${data.senderName} prior to dispatch.

${'='.repeat(50)}
CONFIDENTIALITY NOTICE

This email and any attachments are intended solely for the addressee(s) and may contain confidential or legally privileged information. If you are not the intended recipient, you must not copy, distribute, or take any action in reliance on it. If you have received this email in error, please notify the sender immediately by reply email and delete the original message and any copies.

This communication may contain protected health information (PHI) subject to privacy regulations. Please handle accordingly.

(c) ${currentYear} ${data.practiceName}. Powered by DictateMED (https://dictatemed.com).
`.trim();
}

/**
 * Generates a subject line for the consultation letter email.
 * Avoids including PHI directly in the subject.
 */
export function generateLetterEmailSubject(data: Pick<LetterEmailData, 'letterType' | 'patientIdentifier' | 'practiceName'>): string {
  // Use minimal patient identifier (initials or reference) - no full names
  return `${data.letterType} - Patient ${data.patientIdentifier} | ${data.practiceName}`;
}

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

/**
 * Truncate text to a maximum length, ending at word boundary.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find the last space before maxLength
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace);
  }

  return truncated;
}
