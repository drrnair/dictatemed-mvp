# Document Processing Module

## Overview

This module handles document upload, storage, and clinical data extraction from medical documents using Claude Vision via AWS Bedrock.

## Supported Document Types

### Current (MVP)
- **Images**: PNG, JPEG (up to 20MB)
  - Directly processed by Claude Vision
  - Best for screenshots, scanned reports, photos of documents

### Planned (Post-MVP)
- **PDF Documents**:
  - Currently accepted for upload but **require conversion** before extraction
  - PDF processing requires implementation of PDF-to-image conversion
  - Options for future implementation:
    1. Use `pdf-poppler` or `pdf2pic` for client-side/server-side conversion
    2. Use AWS Textract for direct PDF processing
    3. Use Ghostscript or ImageMagick for conversion

## PDF Processing Strategy

### Current Behavior (MVP)
When a PDF is uploaded:
1. ✅ Upload succeeds - PDF stored in S3
2. ✅ Document record created with `status: 'UPLOADED'`
3. ⚠️ **Extraction will fail** - `fetchImageAsBase64()` doesn't handle PDFs
4. ❌ Document status becomes `FAILED` with error

### Recommended Approach for Users (MVP)
Until PDF processing is implemented, users should:
1. Export PDFs as images before upload, OR
2. Take screenshots of critical pages, OR
3. Use built-in OS tools to convert PDF → PNG/JPEG

### Implementation Plan (Post-MVP)

#### Option 1: Client-Side Conversion (Recommended)
- Use `pdf.js` in the browser to render PDF pages
- Convert each page to canvas → image
- Upload images instead of PDF
- **Pros**: No server processing, works offline
- **Cons**: Large PDFs may cause browser memory issues

#### Option 2: Server-Side Conversion
Add to `extraction.service.ts`:
```typescript
import { fromPath } from 'pdf2pic';

async function convertPdfToImages(pdfPath: string): Promise<string[]> {
  const converter = fromPath(pdfPath, {
    density: 300,
    savePath: '/tmp/pdf-pages',
    format: 'png',
    width: 2550,
    height: 3300,
  });

  // Convert all pages
  const pages = await converter.bulk(-1, { responseType: 'base64' });
  return pages.map(p => p.base64);
}
```

#### Option 3: AWS Textract Integration
- Use Textract's `AnalyzeDocument` API
- Directly processes PDFs without image conversion
- Provides structured data extraction
- **Pros**: Production-ready AWS service
- **Cons**: Additional AWS cost, may not match Claude Vision quality

## Rate Limiting

Document processing is rate-limited to protect against abuse:

- **Document creation**: 20 requests/min per user
- **Document processing**: 5 requests/min per user (stricter due to Claude Vision costs)

Rate limit headers returned in responses:
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: When the limit resets
- `Retry-After`: Seconds to wait (if rate limited)

## File Structure

```
src/domains/documents/
├── document.types.ts          # TypeScript types for all document types
├── document.service.ts        # CRUD operations, S3 integration
├── extraction.service.ts      # Orchestrates Claude Vision extraction
├── extractors/
│   ├── echo-report.ts        # Echo report extraction
│   ├── angiogram-report.ts   # Angiogram extraction
│   └── generic.ts            # Lab results & generic extraction
└── README.md                 # This file
```

## API Endpoints

### `POST /api/documents`
Create a document and get pre-signed upload URL.

**Request:**
```json
{
  "name": "echo-2024-12-20.png",
  "mimeType": "image/png",
  "size": 1048576,
  "type": "ECHO_REPORT", // Optional, auto-inferred
  "patientId": "uuid"    // Optional
}
```

**Response:**
```json
{
  "id": "doc-uuid",
  "uploadUrl": "https://s3.../presigned-url",
  "expiresAt": "2024-12-20T12:00:00Z"
}
```

### `POST /api/documents/:id/process`
Trigger extraction for an uploaded document.

**Response:**
```json
{
  "status": "processing",
  "documentId": "doc-uuid",
  "message": "Document processing started"
}
```

### `GET /api/documents/:id/process`
Check extraction status.

**Response:**
```json
{
  "documentId": "doc-uuid",
  "status": "PROCESSED",
  "extractedData": { /* structured data */ },
  "processingError": null
}
```

## Extracted Data Structure

### Echo Report
```typescript
{
  type: 'ECHO_REPORT',
  lvef: 45,              // Left ventricular ejection fraction (%)
  tapse: 18,             // TAPSE (mm)
  aorticValve: {
    stenosisSeverity: 'moderate',
    regurgitationSeverity: 'mild',
    meanGradient: 25
  },
  // ... 25+ other measurements
}
```

### Angiogram Report
```typescript
{
  type: 'ANGIOGRAM_REPORT',
  lad: {
    stenosis: 80,        // LAD stenosis (%)
    stenosisLocation: 'proximal',
    calcification: 'moderate'
  },
  pciPerformed: true,
  pciDetails: [
    {
      vessel: 'LAD',
      stentType: 'DES',
      stentSize: '3.0 x 28mm',
      timiFlow: 3
    }
  ]
}
```

### Lab Results
```typescript
{
  type: 'LAB_RESULT',
  troponin: { value: 0.05, unit: 'ng/mL', flag: 'normal' },
  bnp: { value: 450, unit: 'pg/mL', flag: 'high' },
  creatinine: { value: 1.2, unit: 'mg/dL' }
}
```

## Confidence Scoring

Extraction confidence is calculated based on fields extracted vs. expected:

- **Echo reports**: Expect ~25 core measurements
- **Angiogram reports**: Expect ~15 core vessel/procedure fields
- **Lab results**: Expect ~10 common lab values

Confidence = (extracted fields / expected fields), capped at 1.0, minimum 0.1 if any data extracted.

## Error Handling

Documents that fail extraction:
- Status set to `FAILED`
- Error message stored in `processingError`
- Can be retried with `POST /api/documents/:id/process`

Common errors:
- **"Unable to fetch image"**: S3 URL expired or document not found
- **"Invalid image format"**: Unsupported MIME type
- **"Vision analysis failed"**: Bedrock API error (check credentials, quotas)
- **PDF processing not implemented**: User uploaded PDF (see strategy above)

## Testing

For local testing without Bedrock:
1. Mock the `analyzeImage` function in tests
2. Use sample JSON responses in `extractors/*.test.ts`
3. Test extraction with real images in CI/CD using Bedrock dev account

## Future Enhancements

1. **PDF Support**: Implement one of the conversion strategies above
2. **Multi-page PDFs**: Use `processMultiPageDocument()` (currently unused)
3. **OCR Fallback**: Use Textract if Claude Vision fails
4. **Confidence Thresholds**: Flag low-confidence extractions for manual review
5. **Extraction Caching**: Cache results to avoid re-processing same document
6. **Custom Extractors**: Allow practice-specific extraction templates
