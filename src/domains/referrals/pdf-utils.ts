// src/domains/referrals/pdf-utils.ts
// PDF text extraction utility
//
// IMPORTANT: This module uses dynamic imports to avoid pdf-parse's problematic
// initialization behavior that tries to read test files at require time.

export interface PdfParseResult {
  text: string;
  numpages: number;
}

/**
 * Extract text content from a PDF buffer.
 *
 * Uses dynamic import to defer loading pdf-parse until runtime,
 * avoiding issues with the library trying to read test files during bundling.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfParseResult> {
  // Dynamic import to avoid pdf-parse initialization issues during build
  // pdf-parse tries to read a test PDF file on require, which fails during Next.js build
  const pdfParse = (await import('pdf-parse')).default;

  const data = await pdfParse(buffer);
  return {
    text: data.text,
    numpages: data.numpages,
  };
}
