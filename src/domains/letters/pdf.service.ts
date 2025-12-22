// src/domains/letters/pdf.service.ts
// PDF generation service for letter documents

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { prisma } from '@/infrastructure/db/client';
import { decryptPatientData } from '@/infrastructure/db/encryption';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'pdf-service' });

/**
 * Page dimensions and margins (A4 in points)
 */
const PAGE = {
  WIDTH: 595.28,  // A4 width
  HEIGHT: 841.89, // A4 height
  MARGIN_TOP: 72,     // 1 inch
  MARGIN_BOTTOM: 72,  // 1 inch
  MARGIN_LEFT: 72,    // 1 inch
  MARGIN_RIGHT: 72,   // 1 inch
} as const;

const FONTS = {
  TITLE_SIZE: 14,
  HEADING_SIZE: 12,
  BODY_SIZE: 11,
  FOOTER_SIZE: 9,
  LINE_HEIGHT: 1.4,
} as const;

/**
 * Letter data needed for PDF generation
 *
 * Note: pdf-lib's StandardFonts only support WinAnsi encoding (basic ASCII + extended Latin).
 * Non-ASCII characters (e.g., ≥, ≤, certain accents) may cause encoding errors.
 * Consider character sanitization for robustness with international names.
 */
interface LetterPdfData {
  id: string;
  letterType: string;
  contentFinal: string;
  approvedAt: Date | null;
  createdAt: Date;
  patient: {
    name: string;
  } | null;
  user: {
    name: string;
    practice: {
      name: string;
    };
  };
}

/**
 * Generate a PDF from a letter
 * @param letterId - The letter ID
 * @returns PDF as Buffer
 */
export async function generateLetterPdf(letterId: string): Promise<Buffer> {
  // Fetch letter with required relations
  const letter = await prisma.letter.findUnique({
    where: { id: letterId },
    select: {
      id: true,
      letterType: true,
      contentFinal: true,
      approvedAt: true,
      createdAt: true,
      patient: {
        select: {
          encryptedData: true,
        },
      },
      user: {
        select: {
          name: true,
          practice: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!letter) {
    throw new Error('Letter not found');
  }

  if (!letter.contentFinal) {
    throw new Error('Letter has no approved content');
  }

  // Decrypt patient data if available
  let patientName = 'Unknown Patient';
  if (letter.patient?.encryptedData) {
    try {
      const patientData = decryptPatientData(letter.patient.encryptedData);
      patientName = patientData.name || 'Unknown Patient';
    } catch (error) {
      log.warn('Failed to decrypt patient data for PDF', { letterId });
    }
  }

  // Build letter data
  const letterData: LetterPdfData = {
    id: letter.id,
    letterType: letter.letterType,
    contentFinal: letter.contentFinal,
    approvedAt: letter.approvedAt,
    createdAt: letter.createdAt,
    patient: { name: patientName },
    user: {
      name: letter.user.name,
      practice: {
        name: letter.user.practice.name,
      },
    },
  };

  return createPdf(letterData);
}

/**
 * Create a PDF document from letter data
 */
async function createPdf(data: LetterPdfData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Add content
  await addContent(pdfDoc, data, regularFont, boldFont);

  // Serialize to bytes
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Add letter content to PDF
 */
async function addContent(
  pdfDoc: PDFDocument,
  data: LetterPdfData,
  regularFont: PDFFont,
  boldFont: PDFFont
): Promise<void> {
  const contentWidth = PAGE.WIDTH - PAGE.MARGIN_LEFT - PAGE.MARGIN_RIGHT;
  const letterDate = data.approvedAt || data.createdAt;
  const formattedDate = format(letterDate, 'dd MMMM yyyy');
  const letterTypeLabel = formatLetterType(data.letterType);

  // Split content into paragraphs
  const paragraphs = data.contentFinal.split(/\n\n+/).filter((p) => p.trim());

  // Create first page
  let page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
  let y = PAGE.HEIGHT - PAGE.MARGIN_TOP;

  // Draw header
  y = drawHeader(page, data, boldFont, y);
  y -= 20; // Space after header

  // Draw date
  page.drawText(formattedDate, {
    x: PAGE.MARGIN_LEFT,
    y,
    size: FONTS.BODY_SIZE,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  y -= 25;

  // Draw subject line
  const subject = `Re: ${data.patient?.name || 'Patient'} - ${letterTypeLabel}`;
  page.drawText(subject, {
    x: PAGE.MARGIN_LEFT,
    y,
    size: FONTS.HEADING_SIZE,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 25;

  // Draw body content
  for (const paragraph of paragraphs) {
    const lines = wrapText(paragraph.trim(), regularFont, FONTS.BODY_SIZE, contentWidth);

    for (const line of lines) {
      // Check if we need a new page
      if (y < PAGE.MARGIN_BOTTOM + 50) {
        // Add footer to current page
        drawFooter(page, data, regularFont, pdfDoc.getPageCount());

        // Create new page
        page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
        y = PAGE.HEIGHT - PAGE.MARGIN_TOP;
      }

      page.drawText(line, {
        x: PAGE.MARGIN_LEFT,
        y,
        size: FONTS.BODY_SIZE,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
      y -= FONTS.BODY_SIZE * FONTS.LINE_HEIGHT;
    }

    // Add paragraph spacing
    y -= 8;
  }

  // Add signature area
  y -= 20;
  if (y < PAGE.MARGIN_BOTTOM + 80) {
    drawFooter(page, data, regularFont, pdfDoc.getPageCount());
    page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
    y = PAGE.HEIGHT - PAGE.MARGIN_TOP;
  }

  page.drawText('Yours sincerely,', {
    x: PAGE.MARGIN_LEFT,
    y,
    size: FONTS.BODY_SIZE,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  y -= 40;

  page.drawText(data.user.name, {
    x: PAGE.MARGIN_LEFT,
    y,
    size: FONTS.BODY_SIZE,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= FONTS.BODY_SIZE * FONTS.LINE_HEIGHT;

  page.drawText(data.user.practice.name, {
    x: PAGE.MARGIN_LEFT,
    y,
    size: FONTS.BODY_SIZE,
    font: regularFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Add footer to last page
  drawFooter(page, data, regularFont, pdfDoc.getPageCount());
}

/**
 * Draw page header with practice name
 */
function drawHeader(
  page: PDFPage,
  data: LetterPdfData,
  boldFont: PDFFont,
  y: number
): number {
  // Practice name as header
  page.drawText(data.user.practice.name, {
    x: PAGE.MARGIN_LEFT,
    y,
    size: FONTS.TITLE_SIZE,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.6), // Dark blue
  });

  return y - FONTS.TITLE_SIZE * 1.5;
}

/**
 * Draw page footer
 */
function drawFooter(
  page: PDFPage,
  data: LetterPdfData,
  font: PDFFont,
  pageNumber: number
): void {
  const footerY = PAGE.MARGIN_BOTTOM - 20;

  // Page number
  const pageText = `Page ${pageNumber}`;
  const pageTextWidth = font.widthOfTextAtSize(pageText, FONTS.FOOTER_SIZE);
  page.drawText(pageText, {
    x: PAGE.WIDTH - PAGE.MARGIN_RIGHT - pageTextWidth,
    y: footerY,
    size: FONTS.FOOTER_SIZE,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Confidentiality notice
  page.drawText('CONFIDENTIAL - Medical in Confidence', {
    x: PAGE.MARGIN_LEFT,
    y: footerY,
    size: FONTS.FOOTER_SIZE,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

/**
 * Wrap text to fit within a given width
 */
function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Format letter type for display
 */
function formatLetterType(letterType: string): string {
  return letterType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Generate a simple text-based PDF from content string
 * (Useful for testing or simple documents)
 */
export async function generateSimplePdf(
  content: string,
  title: string,
  authorName: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const contentWidth = PAGE.WIDTH - PAGE.MARGIN_LEFT - PAGE.MARGIN_RIGHT;
  let page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
  let y = PAGE.HEIGHT - PAGE.MARGIN_TOP;

  // Title
  page.drawText(title, {
    x: PAGE.MARGIN_LEFT,
    y,
    size: FONTS.TITLE_SIZE,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= FONTS.TITLE_SIZE * 2;

  // Date
  page.drawText(format(new Date(), 'dd MMMM yyyy'), {
    x: PAGE.MARGIN_LEFT,
    y,
    size: FONTS.BODY_SIZE,
    font: regularFont,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 25;

  // Content
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());

  for (const paragraph of paragraphs) {
    const lines = wrapText(paragraph.trim(), regularFont, FONTS.BODY_SIZE, contentWidth);

    for (const line of lines) {
      if (y < PAGE.MARGIN_BOTTOM + 50) {
        page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
        y = PAGE.HEIGHT - PAGE.MARGIN_TOP;
      }

      page.drawText(line, {
        x: PAGE.MARGIN_LEFT,
        y,
        size: FONTS.BODY_SIZE,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
      y -= FONTS.BODY_SIZE * FONTS.LINE_HEIGHT;
    }
    y -= 8;
  }

  // Author
  y -= 20;
  page.drawText(authorName, {
    x: PAGE.MARGIN_LEFT,
    y,
    size: FONTS.BODY_SIZE,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
