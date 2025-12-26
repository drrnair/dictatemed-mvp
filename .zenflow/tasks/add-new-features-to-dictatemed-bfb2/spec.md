# Technical Specification: Expanded Referral/Document Upload Types

## Overview

**Feature**: Expand referral/document upload to accept images (HEIC, JPEG, PNG), Word documents (.docx), and RTF files in addition to current PDF and text file support.

**Difficulty**: Medium
- Multiple file types require different handling strategies
- HEIC conversion needed for browser compatibility
- Text extraction varies by file type
- Must maintain backward compatibility with existing PDF/TXT uploads

**Problem Statement**: Clinicians receive referrals in various formats (iPhone photos, Word documents, images) but can only upload PDFs and text files. This forces manual data entry or file conversion before upload.

## Technical Context

### Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: Supabase Storage (private buckets)
- **Testing**: Vitest (unit), Playwright (E2E)

### Key Dependencies
- `pdf-parse`: PDF text extraction (existing)
- `sharp`: Image processing (existing in devDeps, move to deps)
- NEW: `heic-convert`: HEIC to JPEG conversion
- NEW: `mammoth`: Word document text extraction

### Existing Infrastructure
- `src/infrastructure/bedrock/vision.ts`: Claude Vision API wrapper with `analyzeImage()` function
  - Supports `image/png`, `image/jpeg`, `image/gif`, `image/webp` MIME types
  - Uses Claude Sonnet 4 for cost-effective vision tasks

## Current Implementation Analysis

### Files to Modify

| File | Purpose | Changes |
|------|---------|---------|
| `src/domains/referrals/referral.types.ts` | MIME type constants | Add new allowed types |
| `src/domains/referrals/referral.service.ts` | File validation & text extraction | Add HEIC conversion, Word extraction, image OCR |
| `src/app/api/referrals/route.ts` | API validation | Update Zod schema for new MIME types |
| `src/app/api/referrals/[id]/extract-text/route.ts` | Error messages | Update messages for new types |
| `src/components/referral/ReferralUploader.tsx` | UI file input | Update accept attribute, error messages |

### Current MIME Type Configuration

**Location**: `src/domains/referrals/referral.types.ts:199-202`
```typescript
export const ALLOWED_REFERRAL_MIME_TYPES = [
  'application/pdf',
  'text/plain',
] as const;
```

### Current Validation Flow

1. **Client-side** (`ReferralUploader.tsx:125-140`):
   - Checks `isAllowedMimeType(file.type)`
   - Checks `isFileSizeValid(file.size)` (max 10MB)
   - Shows specific error for Word docs

2. **Server-side** (`referral.service.ts:136-148`):
   - Same MIME type validation
   - Same file size validation

3. **API schema** (`route.ts:23-27`):
   - Zod enum validation against `ALLOWED_REFERRAL_MIME_TYPES`

### Current Text Extraction

**Location**: `src/domains/referrals/referral.service.ts:523-649`

Supports:
- `application/pdf` -> `extractPdfText()` via pdf-parse
- `text/plain` -> Direct UTF-8 decode

## Implementation Approach

### New MIME Types to Support

| File Type | MIME Type(s) | Extension | Extraction Strategy |
|-----------|--------------|-----------|---------------------|
| PDF | `application/pdf` | .pdf | Existing: pdf-parse |
| Text | `text/plain` | .txt | Existing: UTF-8 decode |
| JPEG | `image/jpeg` | .jpg, .jpeg | NEW: AI vision (Claude) or OCR |
| PNG | `image/png` | .png | NEW: AI vision (Claude) or OCR |
| HEIC | `image/heic`, `image/heif` | .heic, .heif | NEW: Convert to JPEG, then vision/OCR |
| Word | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | .docx | NEW: mammoth library |
| RTF | `application/rtf`, `text/rtf` | .rtf | NEW: Simple regex-based tag stripping |

### Feature Flag

```bash
# Environment variable
FEATURE_EXTENDED_UPLOAD_TYPES=true
```

When disabled, behavior reverts to PDF + TXT only.

### Architecture Decision: Image Text Extraction

**Decision: AI Vision with Claude**
- Uses existing `analyzeImage()` function from `src/infrastructure/bedrock/vision.ts`
- Already integrated with AWS Bedrock and Claude Sonnet 4
- High accuracy, handles handwriting better than OCR
- Cost-effective since we're already paying for Bedrock
- The referral extraction already calls Claude for structured data extraction

Note: tesseract.js was considered but rejected due to heavy bundle size (~10MB WASM) and lower accuracy.

## Source Code Structure Changes

### New Files

| Path | Purpose |
|------|---------|
| `src/domains/referrals/image-utils.ts` | HEIC conversion, image preprocessing |
| `src/domains/referrals/docx-utils.ts` | Word document text extraction |
| `src/domains/referrals/vision-extraction.ts` | Claude Vision for image text extraction |

### Modified Files

#### 1. `src/domains/referrals/referral.types.ts`

```typescript
// Line 199-204: Expand MIME types
export const ALLOWED_REFERRAL_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  // Images
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  // Documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
] as const;

// Line ~233: Add accepted extensions display string
export const ACCEPTED_REFERRAL_EXTENSIONS = '.pdf, .txt, .jpg, .jpeg, .png, .heic, .docx, .rtf';
```

#### 2. `src/domains/referrals/referral.service.ts`

```typescript
// Line 48-59: Extend getExtensionFromMimeType()
function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf': return 'pdf';
    case 'text/plain': return 'txt';
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/heic':
    case 'image/heif': return 'jpg'; // Converted to JPEG
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'docx';
    case 'application/rtf':
    case 'text/rtf': return 'rtf';
    default: return 'bin';
  }
}

// Line 551-564: Extend extractTextFromDocument() switch
if (document.mimeType === 'application/pdf') {
  extractedText = await extractTextFromPdfBuffer(content, log);
} else if (document.mimeType === 'text/plain') {
  extractedText = content.toString('utf-8');
} else if (document.mimeType.startsWith('image/')) {
  // Convert HEIC to JPEG if needed, then use vision
  extractedText = await extractTextFromImage(content, document.mimeType, log);
} else if (document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
  extractedText = await extractTextFromDocx(content, log);
} else if (document.mimeType === 'application/rtf' || document.mimeType === 'text/rtf') {
  extractedText = await extractTextFromRtf(content, log);
} else {
  throw new Error(`Unsupported MIME type for text extraction: ${document.mimeType}`);
}
```

#### 3. `src/components/referral/ReferralUploader.tsx`

```typescript
// Line 58: Update accepted extensions display
const ACCEPTED_EXTENSIONS = '.pdf, .txt, .jpg, .png, .heic, .docx, .rtf';

// Line 125-140: Update validateFile() error messages
const validateFile = (file: File): string | null => {
  if (!isAllowedMimeType(file.type)) {
    return 'Invalid file type. Please upload a PDF, image (JPEG, PNG, HEIC), Word document, or text file.';
  }
  if (!isFileSizeValid(file.size)) {
    return `File too large. Maximum size is ${formatFileSize(MAX_REFERRAL_FILE_SIZE)}.`;
  }
  return null;
};

// Line 481: Update accept attribute
accept={ALLOWED_REFERRAL_MIME_TYPES.join(',')}
// Will expand to include all new types
```

#### 4. `src/app/api/referrals/[id]/extract-text/route.ts`

```typescript
// Line 107-112: Update error message
if (message.includes('Unsupported MIME type')) {
  return NextResponse.json(
    { error: 'This file type is not supported. Please upload a PDF, image, Word document, or text file.' },
    { status: 400 }
  );
}
```

### New Utility Modules

#### `src/domains/referrals/image-utils.ts`

```typescript
import sharp from 'sharp';

interface ConversionResult {
  buffer: Buffer;
  mimeType: 'image/jpeg';
}

/**
 * Convert HEIC/HEIF to JPEG for browser compatibility and processing.
 * Also normalizes other image formats to JPEG for consistent handling.
 */
export async function convertToJpeg(
  buffer: Buffer,
  sourceMimeType: string
): Promise<ConversionResult> {
  // For HEIC, use heic-convert then sharp
  if (sourceMimeType === 'image/heic' || sourceMimeType === 'image/heif') {
    const heicConvert = (await import('heic-convert')).default;
    const jpegBuffer = await heicConvert({
      buffer,
      format: 'JPEG',
      quality: 0.9,
    });
    return { buffer: Buffer.from(jpegBuffer), mimeType: 'image/jpeg' };
  }

  // For other images, use sharp to normalize to JPEG
  const jpegBuffer = await sharp(buffer)
    .jpeg({ quality: 90 })
    .toBuffer();

  return { buffer: jpegBuffer, mimeType: 'image/jpeg' };
}

/**
 * Validate image can be processed (not corrupted, reasonable dimensions).
 */
export async function validateImage(buffer: Buffer): Promise<void> {
  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not read image dimensions');
  }

  // Limit to 50MP (e.g., 7000x7000)
  const maxPixels = 50_000_000;
  if (metadata.width * metadata.height > maxPixels) {
    throw new Error('Image too large. Maximum resolution is ~50 megapixels.');
  }
}
```

#### `src/domains/referrals/docx-utils.ts`

```typescript
import mammoth from 'mammoth';

interface DocxExtractResult {
  text: string;
  messages: string[];
}

/**
 * Extract plain text from a Word document (.docx).
 */
export async function extractDocxText(buffer: Buffer): Promise<DocxExtractResult> {
  const result = await mammoth.extractRawText({ buffer });

  return {
    text: result.value,
    messages: result.messages.map(m => m.message),
  };
}
```

#### `src/domains/referrals/rtf-utils.ts`

```typescript
/**
 * Extract plain text from an RTF document.
 * Uses simple regex-based tag stripping (no external library required).
 *
 * RTF format uses control words like \par (paragraph), \b (bold), etc.
 * This function strips all RTF formatting to extract raw text.
 */
export function extractRtfText(buffer: Buffer): string {
  const rtfContent = buffer.toString('utf-8');

  // Remove RTF header and footer
  let text = rtfContent
    // Remove RTF groups like {\fonttbl...} {\colortbl...}
    .replace(/\{\\[^{}]*\}/g, '')
    // Remove control words with numeric arguments (\fs24, \cf1, etc.)
    .replace(/\\[a-z]+\d*\s?/gi, '')
    // Replace paragraph markers with newlines
    .replace(/\\par\s?/gi, '\n')
    // Replace line breaks
    .replace(/\\line\s?/gi, '\n')
    // Remove remaining backslash-escaped characters
    .replace(/\\\\/g, '\\')
    .replace(/\\'/g, "'")
    // Remove curly braces
    .replace(/[{}]/g, '')
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  return text;
}
```

#### `src/domains/referrals/vision-extraction.ts`

```typescript
import { analyzeImage } from '@/infrastructure/bedrock';
import { logger } from '@/lib/logger';

const VISION_EXTRACTION_PROMPT = `Extract all text from this medical document image.
Return the text exactly as written, preserving structure where possible.
If this appears to be a referral letter, pay special attention to:
- Patient name and details
- Referring doctor's information
- Medical history and reason for referral
- Dates

Return only the extracted text, no additional commentary.`;

/**
 * Extract text from an image using Claude Vision.
 * Uses the existing analyzeImage() function from infrastructure/bedrock/vision.ts
 */
export async function extractTextFromImageVision(
  imageBuffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png'
): Promise<string> {
  const log = logger.child({ action: 'extractTextFromImageVision' });

  const base64Image = imageBuffer.toString('base64');

  // Use existing analyzeImage from bedrock/vision.ts
  const response = await analyzeImage({
    imageBase64: base64Image,
    mimeType,
    prompt: VISION_EXTRACTION_PROMPT,
    maxTokens: 4096,
  });

  log.info('Vision extraction complete', {
    textLength: response.content.length,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  });

  return response.content;
}
```

## Data Model / API / Interface Changes

### No Database Schema Changes

The existing schema already stores:
- `mimeType: String` - Can store any MIME type string
- `s3Key: String` - Path supports any extension
- `contentText: String?` - Stores extracted text regardless of source format

No migrations required - this is purely additive behavior change.

### API Contract Changes

**POST /api/referrals** - Request body unchanged, but `mimeType` enum expands:

```typescript
// Before
mimeType: z.enum(['application/pdf', 'text/plain'])

// After
mimeType: z.enum([
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
])
```

This is backward compatible - existing PDF/TXT requests continue working.

### TypeScript Interface Changes

```typescript
// referral.types.ts
export type AllowedReferralMimeType = (typeof ALLOWED_REFERRAL_MIME_TYPES)[number];
// Expands from 2 types to 9 types - backward compatible
```

## Verification Approach

### Unit Tests

Create `tests/unit/domains/referrals/`:

1. **image-utils.test.ts**
   - HEIC to JPEG conversion
   - PNG/JPEG passthrough
   - Corrupted image handling
   - Oversized image rejection

2. **docx-utils.test.ts**
   - Basic Word document extraction
   - Complex formatting handling
   - Corrupted file handling

3. **vision-extraction.test.ts** (mocked)
   - Verify Claude API call format
   - Handle API errors gracefully

4. **referral.service.test.ts** (extend existing)
   - Test new MIME types in `isAllowedMimeType()`
   - Test extraction routing by type

### Integration Tests

1. **API endpoint tests** (`tests/integration/api/referrals/`):
   - Upload JPEG → extract text → verify response
   - Upload DOCX → extract text → verify response
   - Reject unsupported types (e.g., .exe)
   - Verify existing PDF flow unchanged

### E2E Tests

1. **ReferralUploader.spec.ts** (extend existing):
   - Upload JPEG file → complete extraction flow
   - Upload HEIC file → verify conversion + extraction
   - Upload DOCX → complete extraction flow
   - Verify error message for invalid types

### Manual Testing Checklist

- [ ] Upload PDF (existing flow) - must still work
- [ ] Upload TXT (existing flow) - must still work
- [ ] Upload JPEG from desktop
- [ ] Upload PNG screenshot
- [ ] Upload HEIC from iPhone (AirDrop to Mac)
- [ ] Upload .docx Word document
- [ ] Upload .rtf file
- [ ] Upload invalid file (.exe) - verify rejection
- [ ] Upload oversized file (>10MB) - verify rejection
- [ ] Upload corrupted image - verify graceful error
- [ ] Feature flag OFF - verify only PDF/TXT accepted

### Verification Commands

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Unit tests
npm run test -- --coverage

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Full verification
npm run verify:full
```

## Dependencies to Add

```json
{
  "dependencies": {
    "heic-convert": "^2.0.0",
    "mammoth": "^1.6.0"
  }
}
```

Move `sharp` from devDependencies to dependencies (already installed).

## HEIC Browser Detection Edge Cases

Some browsers report HEIC files differently:
- Safari/iOS: `image/heic` or `image/heif`
- Chrome/Firefox: May report `application/octet-stream` for HEIC files

**Solution**: In the frontend `validateFile()`, add extension-based fallback for HEIC detection:

```typescript
const validateFile = (file: File): string | null => {
  let mimeType = file.type;

  // Handle HEIC files that browsers report as octet-stream
  if (mimeType === 'application/octet-stream' || mimeType === '') {
    const extension = file.name.toLowerCase().split('.').pop();
    if (extension === 'heic' || extension === 'heif') {
      mimeType = 'image/heic';
    }
  }

  if (!isAllowedMimeType(mimeType)) {
    return 'Invalid file type...';
  }
  // ...
};
```

Note: `sharp` does not natively support HEIC (requires libheif bindings). We use `heic-convert` to convert HEIC to JPEG before passing to sharp for validation/processing.

## Security Considerations

1. **File type spoofing**: Validate actual file content, not just extension/MIME header
   - Use `sharp` to verify images are valid (after HEIC conversion for HEIC files)
   - Use `mammoth` to verify DOCX structure

2. **Malicious files**:
   - Images processed through sharp (sanitizes metadata, re-encodes)
   - DOCX processed through mammoth (text extraction only, no macro execution)

3. **Resource limits**:
   - Max file size: 10MB (existing)
   - Max image resolution: 50MP
   - Timeout on extraction: 30 seconds

4. **PHI in logs**: Continue using existing log sanitization patterns

## Performance Considerations

1. **HEIC conversion**: ~2-5 seconds for typical iPhone photo
2. **Vision extraction**: ~3-10 seconds depending on image complexity
3. **DOCX extraction**: <1 second for typical document

Total worst case: ~15 seconds for HEIC file (convert + vision)
Acceptable since existing PDF extraction can take 5-10 seconds.

## Rollback Plan

1. Set `FEATURE_EXTENDED_UPLOAD_TYPES=false`
2. Restart application
3. New MIME types rejected at validation
4. Existing PDFs/TXTs continue working
5. Already-uploaded new format files remain in storage but cannot be re-processed

No database changes = no data rollback needed.

## Success Metrics

| Metric | Target |
|--------|--------|
| Existing PDF uploads | 100% working (regression) |
| Existing TXT uploads | 100% working (regression) |
| JPEG upload success | >95% |
| PNG upload success | >95% |
| HEIC upload success | >90% (some formats may fail) |
| DOCX upload success | >95% |
| Upload error reduction | >50% |
| No security vulnerabilities | 0 critical/high |
