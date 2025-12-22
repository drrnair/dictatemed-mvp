// src/app/api/style/upload/route.ts
// API endpoint to upload historical letters for style analysis
// Supports both global and per-subspecialty analysis

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import type { Subspecialty } from '@prisma/client';
import { analyzeHistoricalLetters } from '@/domains/style/style.service';
import { createSeedLetter, analyzeSeedLetters } from '@/domains/style';
import { logger } from '@/lib/logger';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 10;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const VALID_SUBSPECIALTIES = [
  'GENERAL_CARDIOLOGY',
  'INTERVENTIONAL',
  'STRUCTURAL',
  'ELECTROPHYSIOLOGY',
  'IMAGING',
  'HEART_FAILURE',
  'CARDIAC_SURGERY',
] as const;

/**
 * POST /api/style/upload
 * Upload historical letters for style analysis.
 * Accepts PDF, DOC, DOCX, or TXT files.
 *
 * Form fields:
 * - files: One or more files to upload
 * - subspecialty: Optional subspecialty to associate letters with
 * - triggerAnalysis: Optional boolean to trigger analysis after upload (default: true)
 *
 * If subspecialty is provided, letters are stored as seed letters for that subspecialty.
 * Otherwise, letters are analyzed globally (legacy behavior).
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'POST /api/style/upload' });

  try {
    // Get authenticated user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const subspecialtyParam = formData.get('subspecialty') as string | null;
    const triggerAnalysisParam = formData.get('triggerAnalysis');
    const triggerAnalysis = triggerAnalysisParam !== 'false';

    // Validate subspecialty if provided
    let subspecialty: Subspecialty | undefined;
    if (subspecialtyParam) {
      if (!VALID_SUBSPECIALTIES.includes(subspecialtyParam as typeof VALID_SUBSPECIALTIES[number])) {
        return NextResponse.json(
          {
            error: 'Invalid subspecialty',
            validValues: VALID_SUBSPECIALTIES,
          },
          { status: 400 }
        );
      }
      subspecialty = subspecialtyParam as Subspecialty;
    }

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
      subspecialty: subspecialty ?? 'global',
      triggerAnalysis,
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

    // Handle per-subspecialty uploads as seed letters
    if (subspecialty) {
      // Create seed letters for each extracted text
      const seedLetterIds: string[] = [];
      for (const letterText of letterTexts) {
        const seedLetter = await createSeedLetter({
          userId,
          subspecialty,
          letterText,
        });
        seedLetterIds.push(seedLetter.id);
      }

      log.info('Seed letters created', {
        userId,
        subspecialty,
        seedLetterCount: seedLetterIds.length,
      });

      // Trigger analysis if requested
      let analysisResult = null;
      if (triggerAnalysis) {
        try {
          analysisResult = await analyzeSeedLetters(userId, subspecialty);
          log.info('Seed letter analysis completed', {
            userId,
            subspecialty,
            profileUpdated: !!analysisResult,
          });
        } catch (err) {
          log.error(
            'Seed letter analysis failed (non-blocking)',
            { userId, subspecialty },
            err instanceof Error ? err : undefined
          );
        }
      }

      return NextResponse.json({
        success: true,
        lettersProcessed: letterTexts.length,
        seedLettersCreated: seedLetterIds.length,
        subspecialty,
        analysisTriggered: triggerAnalysis,
        profile: analysisResult,
        warnings: errors.length > 0 ? errors : undefined,
      });
    }

    // Handle global analysis (legacy behavior)
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
      analysisType: 'global',
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
