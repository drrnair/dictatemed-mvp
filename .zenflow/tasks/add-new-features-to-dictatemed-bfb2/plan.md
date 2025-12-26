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
   - Created `extractTextFromRtfBuffer()` - parses RTF control codes to extract plain text
   - Updated `extractTextFromDocument()` to use the new routing function
2. ✅ Added imports for new utility modules (image-utils, docx-utils, vision-extraction)
3. ✅ Updated test file with mocks for new modules
4. ✅ Added 6 new test cases for extended file types:
   - JPEG image extraction via vision API
   - HEIC to JPEG conversion before vision extraction
   - Word document extraction via mammoth
   - Word document extraction failure handling
   - Image validation failure handling
   - Vision extraction no readable text handling
5. ✅ Updated existing test for unsupported MIME type (now uses video/mp4)

**Verification Results**:
```bash
npm run typecheck  # ✅ Passes
npm run lint  # ✅ No warnings or errors
npm run test -- tests/unit/domains/referrals/referral.service.test.ts  # ✅ 61 tests pass
npm run test -- tests/unit/domains/referrals/  # ✅ 181 total tests pass (no regressions)
```

**Files Modified**:
- `src/domains/referrals/referral.service.ts`
- `tests/unit/domains/referrals/referral.service.test.ts`

---

### [ ] Step: Update API Route Validation

Update API endpoint to accept new MIME types.

**Tasks**:
1. Modify `src/app/api/referrals/route.ts`:
   - Update Zod schema `createReferralSchema` to use expanded MIME types
2. Modify `src/app/api/referrals/[id]/extract-text/route.ts`:
   - Update error messages to reflect new supported types
3. Add integration tests for new file types

**Verification**:
```bash
npm run test:integration -- tests/integration/api/referrals
npm run typecheck
```

**Files Modified**:
- `src/app/api/referrals/route.ts`
- `src/app/api/referrals/[id]/extract-text/route.ts`

---

### [ ] Step: Update Frontend Upload Component

Update the ReferralUploader component for new file types.

**Tasks**:
1. Modify `src/components/referral/ReferralUploader.tsx`:
   - Update `ACCEPTED_EXTENSIONS` constant
   - Update `validateFile()` error messages
   - Update file input `accept` attribute
   - Remove Word-specific error (now supported)
2. Verify drag-and-drop works with new types
3. Add component tests for new file types

**Verification**:
```bash
npm run test -- tests/unit/components/referral/ReferralUploader.test.tsx
npm run typecheck
```

**Files Modified**:
- `src/components/referral/ReferralUploader.tsx`

---

### [ ] Step: Add Feature Flag Configuration

Configure feature flag for safe rollout.

**Tasks**:
1. Add `FEATURE_EXTENDED_UPLOAD_TYPES` to `.env.example`
2. Add feature flag documentation
3. Implement conditional logic in MIME type validation
4. Test with flag enabled and disabled

**Verification**:
```bash
# Test with flag disabled
FEATURE_EXTENDED_UPLOAD_TYPES=false npm run test

# Test with flag enabled
FEATURE_EXTENDED_UPLOAD_TYPES=true npm run test
```

**Files Modified**:
- `.env.example`
- `src/domains/referrals/referral.types.ts`

---

### [ ] Step: Write E2E Tests

Create end-to-end tests for the complete upload flow with new file types.

**Tasks**:
1. Extend `tests/e2e/referral-upload.spec.ts` (or create new):
   - Test JPEG upload → extraction complete
   - Test PNG upload → extraction complete
   - Test DOCX upload → extraction complete
   - Test invalid file rejection (unchanged)
   - Test PDF upload (regression - must still work)
2. Add test fixtures for sample files

**Verification**:
```bash
npm run test:e2e -- tests/e2e/referral-upload.spec.ts
```

**Files Modified/Created**:
- `tests/e2e/referral-upload.spec.ts`
- `tests/fixtures/` (sample files)

---

### [ ] Step: Run Full Verification Suite

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
