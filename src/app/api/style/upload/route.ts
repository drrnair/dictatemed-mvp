// src/app/api/style/upload/route.ts
// API endpoint to upload historical letters for style analysis

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { analyzeHistoricalLetters } from '@/domains/style/style.service';
import { logger } from '@/lib/logger';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 10;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

/**
 * POST /api/style/upload
 * Upload historical letters for style analysis.
 * Accepts PDF, DOC, DOCX, or TXT files.
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'POST /api/style/upload' });

  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.sub;

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed per upload` },
        { status: 400 }
      );
    }

    log.info('Processing historical letter upload', {
      userId,
      fileCount: files.length,
    });

    // Validate and extract text from files
    const letterTexts: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
        errors.push(`${file.name}: Unsupported file type. Use PDF, DOC, DOCX, or TXT.`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large. Maximum size is 10MB.`);
        continue;
      }

      try {
        const text = await extractTextFromFile(file);
        if (text && text.trim().length > 100) {
          letterTexts.push(text);
        } else {
          errors.push(`${file.name}: Could not extract sufficient text from file.`);
        }
      } catch (err) {
        log.error('Failed to extract text from file', { fileName: file.name }, err instanceof Error ? err : undefined);
        errors.push(`${file.name}: Failed to process file.`);
      }
    }

    if (letterTexts.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid letters could be processed',
          details: errors,
        },
        { status: 400 }
      );
    }

    // Analyze historical letters
    const result = await analyzeHistoricalLetters(userId, letterTexts);

    log.info('Historical letter analysis completed', {
      userId,
      lettersAnalyzed: letterTexts.length,
      profileUpdated: result.profileUpdated,
    });

    return NextResponse.json({
      success: true,
      lettersProcessed: letterTexts.length,
      profileUpdated: result.profileUpdated,
      profile: result.profile,
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    log.error('Historical letter upload failed', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Failed to process historical letters',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract text content from uploaded file.
 * For MVP, we support plain text extraction.
 * PDF/DOC extraction would require additional libraries in production.
 */
async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  // Plain text files
  if (fileName.endsWith('.txt') || file.type === 'text/plain') {
    return await file.text();
  }

  // For PDF and DOC files in MVP, we'll read as text
  // In production, you'd use pdf-parse, mammoth, etc.
  // For now, attempt to read as text (works for some simple files)
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Try to extract readable text from the buffer
  // This is a simplified approach - production would use proper parsers
  let text = '';

  // For DOCX files (which are ZIP archives), we can try basic extraction
  if (fileName.endsWith('.docx')) {
    text = extractTextFromDocx(uint8Array);
  } else if (fileName.endsWith('.pdf')) {
    // Basic PDF text extraction (very simplified)
    text = extractTextFromPdf(uint8Array);
  } else {
    // Try reading as text
    const decoder = new TextDecoder('utf-8', { fatal: false });
    text = decoder.decode(uint8Array);
  }

  // Clean up extracted text
  return cleanExtractedText(text);
}

/**
 * Basic DOCX text extraction.
 * DOCX files are ZIP archives containing XML.
 */
function extractTextFromDocx(data: Uint8Array): string {
  // Convert to string and look for text content
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const content = decoder.decode(data);

  // Extract text between XML tags (simplified)
  const textMatches = content.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
  if (textMatches) {
    return textMatches
      .map(match => match.replace(/<[^>]+>/g, ''))
      .join(' ');
  }

  // Fallback: extract any readable text
  return content.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\n\r]/g, ' ');
}

/**
 * Basic PDF text extraction.
 * This is very simplified - production would use pdf-parse library.
 */
function extractTextFromPdf(data: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const content = decoder.decode(data);

  // Look for text streams in PDF (simplified)
  const textParts: string[] = [];

  // Extract text between stream markers
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let match;
  while ((match = streamRegex.exec(content)) !== null) {
    const streamContent = match[1];
    if (streamContent) {
      // Extract text operators (Tj, TJ)
      const textOps = streamContent.match(/\(([^)]+)\)\s*Tj|\[([^\]]+)\]\s*TJ/g);
      if (textOps) {
        textParts.push(...textOps.map(op =>
          op.replace(/[\(\)\[\]TJtj\s]/g, '')
        ));
      }
    }
  }

  if (textParts.length > 0) {
    return textParts.join(' ');
  }

  // Fallback: extract any readable ASCII text
  return content.replace(/[^\x20-\x7E\n\r]/g, ' ').replace(/\s+/g, ' ');
}

/**
 * Clean up extracted text for analysis.
 */
function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}
