# E2E Test Referral Fixtures

This directory contains sample referral documents for E2E testing of the referral upload and extraction workflow.

## Contents

### Base Types (Always Enabled)
- `cardiology-referral-001.pdf` - Heart failure referral (routine)
- `cardiology-referral-002.pdf` - Chest pain referral (urgent)
- `*.txt` - Source text files used to generate PDFs

### Extended Types (Feature Flag: FEATURE_EXTENDED_UPLOAD_TYPES)
- `image-referral-001.jpg` - JPEG image referral (routine)
- `image-referral-001.png` - PNG image referral (routine)
- `docx-referral-001.docx` - Word document referral (routine)

## Generating PDF Files

The `.txt` files contain the referral content. To generate PDF files:

### Option 1: Using the generator script

```bash
npm run generate:referral-pdfs
```

### Option 2: Manual generation

You can convert the `.txt` files to PDFs using various tools:

1. **LibreOffice (command line)**:
   ```bash
   libreoffice --headless --convert-to pdf cardiology-referral-001.txt
   ```

2. **macOS**:
   ```bash
   cupsfilter cardiology-referral-001.txt > cardiology-referral-001.pdf
   ```

3. **Online tools**:
   - Upload the `.txt` file to any text-to-PDF converter

4. **Programmatically (Node.js)**:
   ```javascript
   const PDFDocument = require('pdfkit');
   const fs = require('fs');

   const content = fs.readFileSync('cardiology-referral-001.txt', 'utf-8');
   const doc = new PDFDocument();
   doc.pipe(fs.createWriteStream('cardiology-referral-001.pdf'));
   doc.text(content);
   doc.end();
   ```

## Expected Extraction Results

The expected extraction results for each PDF are defined in:
`tests/e2e/fixtures/test-data.ts` → `EXPECTED_REFERRAL_EXTRACTIONS`

Tests verify that the extracted data matches these expected values.

## Test Data Prefix

All patient and referrer names in these referrals use the `TEST-` prefix to:
- Ensure easy identification as test data
- Prevent confusion with real PHI
- Enable easy cleanup of test data

## Generating Extended Type Fixtures

To generate image and DOCX test fixtures:

```bash
npm run generate:test-fixtures
```

This creates:
- `image-referral-001.jpg` - JPEG with embedded referral text
- `image-referral-001.png` - PNG version of the same referral
- `docx-referral-001.docx` - Word document with referral content

## Adding New Referral Types

1. Create a new `.txt` file with the referral content
2. Add expected extraction results to `test-data.ts`
3. Generate the PDF using one of the methods above
4. Add tests for the new referral type

### For Extended Types (Images/DOCX)

1. Add content to `scripts/generate-test-fixtures.ts`
2. Run `npm run generate:test-fixtures`
3. Add expected extraction results to `test-data.ts`
4. Add tests to `tests/e2e/flows/extended-upload-types.spec.ts`

## File Format

Referral documents follow a standard Australian GP referral letter format:
- Letterhead with practice details
- Patient information block
- Clinical history and reason for referral
- Relevant test results
- Referring doctor details
