# Expanded File Upload Types - Implementation Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/add-new-features-to-dictatemed-bfb2`
- **Specification**: `spec.md`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions - get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification

**Status**: Complete

Created comprehensive technical specification in `spec.md` covering:
- MIME type expansion from 2 types (PDF, TXT) to 9 types
- New extraction utilities for images (via Claude Vision), Word docs (mammoth), RTF
- HEIC to JPEG conversion for iPhone photos (heic-convert + sharp)
- Feature flag: `FEATURE_EXTENDED_UPLOAD_TYPES`
- No database schema changes required (additive behavior change)
- Security considerations: file validation, resource limits

**Difficulty Assessment**: Medium
- Multiple file types with different handling strategies
- HEIC conversion adds complexity
- Must maintain 100% backward compatibility

---

### [x] Step: Add Dependencies

**Status**: Complete

Installed required npm packages for new file type support:
- Added `heic-convert@^2.1.0` for HEIC to JPEG conversion
- Added `mammoth@^1.11.0` for Word document text extraction
- Moved `sharp@^0.34.5` from devDependencies to dependencies

**Completed Tasks**:
1. ✅ Added `heic-convert` for HEIC to JPEG conversion
2. ✅ Added `mammoth` for Word document text extraction
3. ✅ Moved `sharp` from devDependencies to dependencies
4. ✅ Ran `npm install` - no conflicts (pre-existing vulnerabilities from ESLint v8)
5. ✅ `.gitignore` already properly configured (no changes needed)
6. ✅ TypeScript type checking passes

**Files Modified**:
- `package.json`
- `package-lock.json`

---

### [x] Step: Create Image Utilities Module

**Status**: Complete

Created image processing utilities for HEIC conversion and image validation.

**Completed Tasks**:
1. ✅ Created `src/domains/referrals/image-utils.ts` with:
   - `convertToJpeg()` - converts HEIC/HEIF/PNG to JPEG using heic-convert and sharp
   - `validateImage()` - validates image dimensions and corruption
   - `validateHeicImage()` - validates HEIC images via conversion test
   - `validateImageByType()` - routes validation by MIME type
   - Helper functions: `isImageMimeType()`, `isHeicMimeType()`
   - Constants: `IMAGE_MIME_TYPES`, `MAX_IMAGE_PIXELS` (50MP), `JPEG_QUALITY` (90)
2. ✅ Created `src/types/heic-convert.d.ts` - TypeScript declarations for heic-convert
3. ✅ Created unit tests in `tests/unit/domains/referrals/image-utils.test.ts` - 29 passing tests

**Verification Results**:
```bash
npm run typecheck  # ✅ Passes
npm run test -- tests/unit/domains/referrals/image-utils.test.ts  # ✅ 29 tests pass
npm run test -- tests/unit/domains/referrals/  # ✅ 109 total tests pass (no regressions)
```

**Files Created**:
- `src/domains/referrals/image-utils.ts`
- `src/types/heic-convert.d.ts`
- `tests/unit/domains/referrals/image-utils.test.ts`

---

### [x] Step: Create Word Document Utilities Module

**Status**: Complete

Created Word document text extraction utilities using mammoth.

**Completed Tasks**:
1. ✅ Created `src/domains/referrals/docx-utils.ts` with:
   - `extractDocxText()` - extracts raw text from .docx files using mammoth
   - `isValidDocxBuffer()` - validates ZIP signature (docx structure check)
   - `validateAndExtractDocx()` - combines validation and extraction
   - `isDocxMimeType()` - type guard for DOCX MIME type
   - Constants: `DOCX_MIME_TYPES`
   - Graceful error handling - returns structured result, never throws
2. ✅ Mammoth has built-in TypeScript types (`node_modules/mammoth/lib/index.d.ts`) - no additional declarations needed
3. ✅ Created unit tests in `tests/unit/domains/referrals/docx-utils.test.ts` - 31 passing tests

**Verification Results**:
```bash
npm run typecheck  # ✅ Passes
npm run test -- tests/unit/domains/referrals/docx-utils.test.ts  # ✅ 31 tests pass
npm run test -- tests/unit/domains/referrals/  # ✅ 140 total tests pass (no regressions)
```

**Files Created**:
- `src/domains/referrals/docx-utils.ts`
- `tests/unit/domains/referrals/docx-utils.test.ts`

---

### [x] Step: Create Vision Extraction Module

**Status**: Complete

Created Claude Vision integration for image text extraction using existing Bedrock infrastructure.

**Completed Tasks**:
1. ✅ Created `src/domains/referrals/vision-extraction.ts` with:
   - `extractTextFromImageVision()` - extracts text from images via Claude Vision API
   - `extractTextFromImageBufferVision()` - convenience wrapper for Buffer input
   - `isVisionSupportedMimeType()` - type guard for vision-supported MIME types
   - `REFERRAL_EXTRACTION_PROMPT` - optimized prompt for medical referral documents
   - Constants: `VISION_SUPPORTED_MIME_TYPES` (jpeg, png, gif, webp)
   - Structured result type with success/error/token tracking
   - Graceful error handling with retryable error detection (throttling, timeouts, 503/429)
   - Special handling for `[NO_READABLE_TEXT]` response (blurry/dark images)
2. ✅ Created unit tests in `tests/unit/domains/referrals/vision-extraction.test.ts` - 34 passing tests
3. ✅ No additional type declarations needed (uses existing Bedrock types)

**Verification Results**:
```bash
npm run typecheck  # ✅ Passes
npm run test -- tests/unit/domains/referrals/vision-extraction.test.ts  # ✅ 34 tests pass
npm run test -- tests/unit/domains/referrals/  # ✅ 175 total tests pass (no regressions)
```

**Files Created**:
- `src/domains/referrals/vision-extraction.ts`
- `tests/unit/domains/referrals/vision-extraction.test.ts`

---

### [x] Step: Expand MIME Type Constants

**Status**: Complete

Updated type definitions to support new file types with feature flag support.

**Completed Tasks**:
1. ✅ Modified `src/domains/referrals/referral.types.ts`:
   - Added `BASE_REFERRAL_MIME_TYPES` (PDF, TXT - always allowed)
   - Added `EXTENDED_REFERRAL_MIME_TYPES` (JPEG, PNG, HEIC, HEIF, DOCX, RTF)
   - `ALLOWED_REFERRAL_MIME_TYPES` now combines both arrays (9 types total)
   - Added `ACCEPTED_REFERRAL_EXTENSIONS` for UI display
   - Added `BASE_ACCEPTED_EXTENSIONS` for when feature is disabled
2. ✅ Updated `isAllowedMimeType()` to respect feature flag:
   - Base types always allowed
   - Extended types only allowed when `FEATURE_EXTENDED_UPLOAD_TYPES=true`
3. ✅ Added helper functions:
   - `isExtendedUploadTypesEnabled()` - checks feature flag
   - `isBaseMimeType()` - checks if MIME type is base type
   - `isExtendedMimeType()` - checks if MIME type is extended
   - `getAllowedMimeTypes()` - returns currently allowed types (respects flag)
   - `getAcceptedExtensions()` - returns extension string for UI (respects flag)
4. ✅ Added new types: `BaseReferralMimeType`, `ExtendedReferralMimeType`

**Verification Results**:
```bash
npm run typecheck  # ✅ Passes
npm run lint  # ✅ No warnings or errors
npm run test -- tests/unit/domains/referrals/  # ✅ 175 tests pass (no regressions)
npm run test:integration -- tests/integration/api/referrals.test.ts  # ✅ 20 tests pass
```

**Files Modified**:
- `src/domains/referrals/referral.types.ts`

---

### [x] Step: Update Referral Service Text Extraction

**Status**: Complete

Extended the text extraction logic to handle new file types (images, DOCX, RTF).

**Completed Tasks**:
1. ✅ Modified `src/domains/referrals/referral.service.ts`:
   - Updated `getExtensionFromMimeType()` with new MIME type mappings (jpg, png, heic, heif, docx, rtf)
   - Created `extractTextByMimeType()` - routing function for type-specific extraction
   - Created `extractTextFromImageBuffer()` - handles HEIC conversion + Claude Vision OCR
   - Created `extractTextFromDocxBuffer()` - uses mammoth for Word document extraction
   - Created `extractTextFromRtfBuffer()` - stack-based RTF parser with proper brace handling
   - Created `parseRtfContent()` - full RTF parsing supporting:
     - Nested brace structures (font tables, color tables, stylesheets)
     - Destination group skipping (fonttbl, colortbl, info, pict, etc.)
     - Hex characters (`\'e9` → `é`)
     - Unicode with negative values (`\u-10?` → signed 16-bit conversion)
     - Typography characters (emdash, endash, smart quotes, bullets)
   - Updated `extractTextFromDocument()` to use the new routing function
   - Clarified PNG conversion comment (fallback for future formats, not PNG)
2. ✅ Added imports for new utility modules (image-utils, docx-utils, vision-extraction)
3. ✅ Updated test file with mocks for new modules
4. ✅ Added 11 new test cases for extended file types:
   - JPEG image extraction via vision API
   - HEIC to JPEG conversion before vision extraction
   - Word document extraction via mammoth
   - Word document extraction failure handling
   - Image validation failure handling
   - Vision extraction no readable text handling
   - RTF document extraction with nested font tables
   - RTF with hex characters (café)
   - RTF with Unicode characters (€)
   - RTF with invalid header (error handling)
   - RTF with special typography (smart quotes, dashes, bullets)
5. ✅ Updated existing test for unsupported MIME type (now uses video/mp4)

**Code Review Fixes Applied**:
- Fixed RTF parser to use stack-based brace matching (was using regex that didn't handle nesting)
- Added support for negative Unicode values in RTF (`\u-10?` syntax)
- Clarified PNG conversion comment (it's a fallback, not actually used for PNG)
- Used `String.charAt()` instead of bracket notation for TypeScript safety

**Verification Results**:
```bash
npm run typecheck  # ✅ Passes
npm run lint  # ✅ No warnings or errors
npm run test -- tests/unit/domains/referrals/referral.service.test.ts  # ✅ 66 tests pass
npm run test -- tests/unit/domains/referrals/  # ✅ 242 total tests pass (no regressions)
```

**Files Modified**:
- `src/domains/referrals/referral.service.ts`
- `tests/unit/domains/referrals/referral.service.test.ts`

---

### [x] Step: Update API Route Validation

**Status**: Complete

Updated API endpoints to validate new MIME types with feature flag support.

**Completed Tasks**:
1. ✅ Modified `src/app/api/referrals/route.ts`:
   - Updated Zod schema `createReferralSchema` to use `superRefine()` for runtime feature flag checking
   - Added imports for `isAllowedMimeType()` and `getAcceptedExtensions()`
   - Extended types are validated against feature flag at request time (not module load time)
2. ✅ Modified `src/app/api/referrals/[id]/extract-text/route.ts`:
   - Updated error message to use dynamic `getAcceptedExtensions()` function
   - Error message now reflects currently enabled file types based on feature flag
3. ✅ Added 9 new integration tests for MIME type validation:
   - Test unsupported MIME type rejection (video/mp4)
   - Test extended types rejected when feature flag disabled
   - Test JPEG acceptance when feature flag enabled
   - Test PNG acceptance when feature flag enabled
   - Test HEIC acceptance when feature flag enabled
   - Test DOCX acceptance when feature flag enabled
   - Test RTF acceptance when feature flag enabled
   - Test PDF always accepted regardless of flag
   - Test TXT always accepted regardless of flag

**Verification Results**:
```bash
npm run typecheck  # ✅ Passes
npm run lint  # ✅ No warnings or errors
npm run test -- tests/unit/domains/referrals/  # ✅ 181 tests pass (no regressions)
npm run test:integration -- tests/integration/api/referrals.test.ts  # ✅ 28 tests pass
```

**Files Modified**:
- `src/app/api/referrals/route.ts`
- `src/app/api/referrals/[id]/extract-text/route.ts`
- `tests/integration/api/referrals.test.ts`

---

### [x] Step: Update Frontend Upload Component

**Status**: Complete

Updated the ReferralUploader component to support new file types with feature flag.

**Completed Tasks**:
1. ✅ Modified `src/components/referral/ReferralUploader.tsx`:
   - Removed hardcoded `ACCEPTED_EXTENSIONS` constant
   - Added imports for `getAllowedMimeTypes()`, `getAcceptedExtensions()`, `isExtendedUploadTypesEnabled()`
   - Updated `validateFile()` to show Word-specific error only when feature flag is disabled
   - Updated error message to dynamically show allowed extensions: `Invalid file type. Please upload one of: ${extensions}`
   - Updated file input `accept` attribute to use `getAllowedMimeTypes().join(',')`
   - Updated UI display to use `getAcceptedExtensions()` function
2. ✅ Verified drag-and-drop works with new types (via tests)
3. ✅ Added 12 new component tests for extended file types:
   - Base extensions shown when flag disabled
   - Extended extensions shown when flag enabled
   - JPEG/PNG/HEIC/DOCX/RTF acceptance when flag enabled
   - JPEG/DOCX rejection when flag disabled
   - Word documents show specific error when flag disabled
   - Drag-and-drop with JPEG and DOCX files
   - Unsupported files (video/mp4) rejected even with flag enabled

**Verification Results**:
```bash
npm run typecheck  # ✅ Passes
npm run lint  # ✅ No warnings or errors
npm run test -- tests/unit/components/ReferralUploader.test.tsx  # ✅ 48 tests pass
npm run test -- tests/unit/domains/referrals/  # ✅ 181 tests pass (no regressions)
```

**Files Modified**:
- `src/components/referral/ReferralUploader.tsx`
- `tests/unit/components/ReferralUploader.test.tsx`

---

### [x] Step: Add Feature Flag Configuration

**Status**: Complete

Configured feature flag for safe rollout of extended upload types.

**Completed Tasks**:
1. ✅ Added `FEATURE_EXTENDED_UPLOAD_TYPES` to `.env.example` with documentation:
   - Set to `"false"` by default (safe rollout)
   - Clear comment explaining what the flag enables
2. ✅ Feature flag logic already implemented in `referral.types.ts`:
   - `isExtendedUploadTypesEnabled()` - checks flag value
   - `isAllowedMimeType()` - respects flag for extended types
   - `getAllowedMimeTypes()` - returns types based on flag
   - `getAcceptedExtensions()` - returns UI extensions based on flag
3. ✅ Fixed test for invalid MIME type (now uses video/mp4 instead of image/jpeg)
4. ✅ Verified tests pass with both flag settings:
   - `FEATURE_EXTENDED_UPLOAD_TYPES=false` - 181 tests pass
   - `FEATURE_EXTENDED_UPLOAD_TYPES=true` - 181 tests pass

**Verification Results**:
```bash
# Test with flag disabled (default)
FEATURE_EXTENDED_UPLOAD_TYPES=false npm run test -- tests/unit/domains/referrals/  # ✅ 181 tests pass

# Test with flag enabled
FEATURE_EXTENDED_UPLOAD_TYPES=true npm run test -- tests/unit/domains/referrals/  # ✅ 181 tests pass

# Integration tests
npm run test:integration -- tests/integration/api/referrals.test.ts  # ✅ 28 tests pass

# Frontend component tests
npm run test -- tests/unit/components/ReferralUploader.test.tsx  # ✅ 48 tests pass
```

**Files Modified**:
- `.env.example`
- `tests/unit/domains/referrals/referral.service.test.ts` (fixed invalid MIME type test)

---

### [x] Step: Write E2E Tests

**Status**: Complete

Created comprehensive E2E tests for extended file upload types (JPEG, PNG, DOCX).

**Completed Tasks**:
1. ✅ Created `tests/e2e/flows/extended-upload-types.spec.ts` with 18 tests:
   - JPEG Image Upload (3 tests): upload success, extraction via Vision API, review panel
   - PNG Image Upload (2 tests): upload success, extraction with same accuracy as JPEG
   - Word Document Upload (3 tests): upload success, patient/referrer extraction, review panel
   - Error Handling (3 tests): image extraction failure, DOCX extraction failure, low confidence warning
   - Regression Tests (2 tests): PDF still works, TXT still works
   - Complete Workflow (2 tests): full workflow with JPEG, full workflow with DOCX
   - Accessibility (1 test): file type announcement for new formats
2. ✅ Created `scripts/generate-test-fixtures.ts` for generating test fixtures:
   - Generates JPEG image with referral text (via sharp SVG rendering)
   - Generates PNG image with same referral content
   - Generates DOCX with structured referral document (via docx library)
3. ✅ Added test fixtures to `tests/e2e/fixtures/referrals/`:
   - `image-referral-001.jpg` (81KB)
   - `image-referral-001.png` (77KB)
   - `docx-referral-001.docx` (8KB)
4. ✅ Updated `tests/e2e/fixtures/test-data.ts`:
   - Added expected extractions for `image-referral-001` and `docx-referral-001`
5. ✅ Updated `tests/e2e/page-objects/ReferralUploadPage.ts`:
   - Changed file input selector to support all file types (not just PDF)
6. ✅ Updated `tests/e2e/fixtures/referrals/README.md` with new file documentation
7. ✅ Added `docx` dev dependency and `generate:test-fixtures` npm script

**Verification Results**:
```bash
npm run typecheck  # ✅ Passes
npm run lint  # ✅ No warnings or errors
npm run test -- tests/unit/domains/referrals/  # ✅ 242 tests pass (no regressions)
npx playwright test tests/e2e/flows/extended-upload-types.spec.ts --list  # ✅ 18 tests recognized
npm run generate:test-fixtures  # ✅ Fixtures generated successfully
```

**Files Created**:
- `tests/e2e/flows/extended-upload-types.spec.ts`
- `scripts/generate-test-fixtures.ts`
- `tests/e2e/fixtures/referrals/image-referral-001.jpg`
- `tests/e2e/fixtures/referrals/image-referral-001.png`
- `tests/e2e/fixtures/referrals/docx-referral-001.docx`

**Files Modified**:
- `tests/e2e/fixtures/test-data.ts`
- `tests/e2e/page-objects/ReferralUploadPage.ts`
- `tests/e2e/fixtures/referrals/README.md`
- `package.json` (added docx dev dependency, generate:test-fixtures script)

---

### [ ] Step: Run Full Verification Suite
<!-- chat-id: 3374ea46-7b20-4289-aac1-cd4295005c4f -->

Ensure all tests pass and no regressions.

**Tasks**:
1. Run full test suite
2. Run linting
3. Run type checking
4. Check test coverage meets thresholds
5. Manual testing with real files

**Verification**:
```bash
npm run verify:full
npm run test:coverage
```

**Success Criteria**:
- All unit tests pass
- All integration tests pass
- All E2E tests pass
- Lint: 0 errors
- TypeScript: 0 errors
- Coverage: >80% for new code

---

### [ ] Step: Create Implementation Report

Document what was implemented and tested.

**Tasks**:
1. Create `report.md` with:
   - Summary of changes
   - Files created/modified
   - Test results
   - Known limitations
   - Rollback instructions

**Files Created**:
- `.zenflow/tasks/add-new-features-to-dictatemed-bfb2/report.md`

---

## Safety Checklist (Before Merge)

### Code Safety
- [ ] No modifications to existing API endpoint contracts (only additive)
- [ ] No database schema changes
- [ ] Feature flag implemented and tested
- [ ] Error handling comprehensive
- [ ] Graceful degradation if external services fail

### Testing Safety
- [ ] All new code has unit tests
- [ ] Integration tests pass
- [ ] E2E tests pass (including existing workflows)
- [ ] Manual regression testing complete
- [ ] Tested with feature flag on/off

### Security Safety
- [ ] File content validated (not just extension)
- [ ] Image dimensions limited
- [ ] No macro execution in documents
- [ ] PHI handling compliant
- [ ] No secrets in code

### Performance Safety
- [ ] HEIC conversion <5 seconds
- [ ] Vision extraction <10 seconds
- [ ] No memory leaks with large files
- [ ] Bundle size increase <100KB

---

## Notes

- All existing PDF/TXT uploads must continue working unchanged
- HEIC support is critical for iPhone users (major use case)
- Claude Vision provides better accuracy than OCR for handwritten referrals
- RTF extraction is lower priority but included for completeness
