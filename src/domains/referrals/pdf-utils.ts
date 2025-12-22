// src/domains/referrals/pdf-utils.ts
// PDF text extraction utility

// pdf-parse v1.x is a CommonJS module - using require for CJS compatibility
const pdfParse = require('pdf-parse') as (
  dataBuffer: Buffer
) => Promise<{ text: string; numpages: number; info: unknown }>;

export interface PdfParseResult {
  text: string;
  numpages: number;
}

/**
 * Extract text content from a PDF buffer.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfParseResult> {
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    numpages: data.numpages,
  };
}
