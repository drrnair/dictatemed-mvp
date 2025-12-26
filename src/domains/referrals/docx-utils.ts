// src/domains/referrals/docx-utils.ts
// Word document (.docx) text extraction utilities for referral document handling.
//
// Uses mammoth for extracting raw text from Word documents.
// Designed for graceful error handling - extraction failures return empty text, not exceptions.

/**
 * Result from Word document text extraction.
 */
export interface DocxExtractionResult {
  /** Extracted text content */
  text: string;
  /** Whether extraction was successful */
  success: boolean;
  /** Warning/error messages from the extraction process */
  messages: DocxMessage[];
  /** Error description if extraction failed */
  error?: string;
}

/**
 * Message from the mammoth extraction process.
 */
export interface DocxMessage {
  type: 'warning' | 'error';
  message: string;
}

/**
 * MIME types for Word documents.
 */
export const DOCX_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type DocxMimeType = (typeof DOCX_MIME_TYPES)[number];

/**
 * Check if a MIME type is a Word document type.
 */
export function isDocxMimeType(mimeType: string): mimeType is DocxMimeType {
  return (DOCX_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Extract raw text from a Word document (.docx) buffer.
 *
 * Uses mammoth to parse the document and extract all text content.
 * Handles errors gracefully - returns empty text with error details rather than throwing.
 *
 * @param buffer - Raw .docx file buffer
 * @returns Extraction result with text and status
 *
 * @example
 * ```typescript
 * const docxBuffer = await fs.readFile('document.docx');
 * const result = await extractDocxText(docxBuffer);
 *
 * if (result.success) {
 *   console.log('Extracted text:', result.text);
 * } else {
 *   console.error('Extraction failed:', result.error);
 * }
 * ```
 */
export async function extractDocxText(buffer: Buffer): Promise<DocxExtractionResult> {
  try {
    // Dynamic import to avoid bundling issues
    const mammoth = await import('mammoth');

    const result = await mammoth.extractRawText({ buffer });

    // Convert mammoth messages to our format
    const messages: DocxMessage[] = result.messages.map((msg) => ({
      type: msg.type as 'warning' | 'error',
      message: msg.message,
    }));

    // Check for extraction errors (mammoth may return messages with type 'error')
    const hasErrors = messages.some((m) => m.type === 'error');

    return {
      text: result.value.trim(),
      success: !hasErrors,
      messages,
      error: hasErrors ? 'Document contains extraction errors' : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      text: '',
      success: false,
      messages: [],
      error: `Failed to extract text from Word document: ${errorMessage}`,
    };
  }
}

/**
 * Validate that a buffer appears to be a valid Word document.
 *
 * Performs a quick check by looking for the ZIP file signature (PK)
 * that all .docx files should have (since .docx is a ZIP archive).
 *
 * @param buffer - Raw file buffer
 * @returns Whether the buffer appears to be a valid .docx file
 */
export function isValidDocxBuffer(buffer: Buffer): boolean {
  // .docx files are ZIP archives, so they start with "PK" (0x50 0x4B)
  if (buffer.length < 4) {
    return false;
  }

  // Check ZIP file signature (PK\x03\x04)
  return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

/**
 * Validate and extract text from a Word document.
 *
 * Combines validation and extraction in a single operation.
 * First validates the buffer structure, then attempts text extraction.
 *
 * @param buffer - Raw file buffer
 * @returns Extraction result with text and status
 */
export async function validateAndExtractDocx(buffer: Buffer): Promise<DocxExtractionResult> {
  // Quick structure validation
  if (!isValidDocxBuffer(buffer)) {
    return {
      text: '',
      success: false,
      messages: [],
      error: 'Invalid Word document: File does not have the expected .docx structure',
    };
  }

  // Attempt full extraction
  return extractDocxText(buffer);
}
