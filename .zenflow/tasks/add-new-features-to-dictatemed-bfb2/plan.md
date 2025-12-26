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

### [ ] Step: Add Dependencies

Install required npm packages for new file type support.

**Tasks**:
1. Add `heic-convert` for HEIC to JPEG conversion
2. Add `mammoth` for Word document text extraction
3. Move `sharp` from devDependencies to dependencies
4. Run `npm install` and verify no conflicts
5. Update `.gitignore` if needed for any generated files

**Verification**:
```bash
npm install heic-convert mammoth
npm install sharp --save
npm run typecheck
```

**Files Modified**:
- `package.json`
- `package-lock.json`

---

### [ ] Step: Create Image Utilities Module

Create image processing utilities for HEIC conversion and image validation.

**Tasks**:
1. Create `src/domains/referrals/image-utils.ts`
2. Implement `convertToJpeg()` - converts HEIC/HEIF/PNG to JPEG
3. Implement `validateImage()` - checks dimensions, corruption
4. Add TypeScript types for conversion results
5. Create unit tests in `tests/unit/domains/referrals/image-utils.test.ts`

**Verification**:
```bash
npm run test -- tests/unit/domains/referrals/image-utils.test.ts
npm run typecheck
```

**Files Created**:
- `src/domains/referrals/image-utils.ts`
- `tests/unit/domains/referrals/image-utils.test.ts`

---

### [ ] Step: Create Word Document Utilities Module

Create utilities for Word document (.docx) text extraction.

**Tasks**:
1. Create `src/domains/referrals/docx-utils.ts`
2. Implement `extractDocxText()` using mammoth
3. Handle extraction errors gracefully
4. Create unit tests in `tests/unit/domains/referrals/docx-utils.test.ts`

**Verification**:
```bash
npm run test -- tests/unit/domains/referrals/docx-utils.test.ts
npm run typecheck
```

**Files Created**:
- `src/domains/referrals/docx-utils.ts`
- `tests/unit/domains/referrals/docx-utils.test.ts`

---

### [ ] Step: Create Vision Extraction Module

Create Claude Vision integration for image text extraction.

**Tasks**:
1. Create `src/domains/referrals/vision-extraction.ts`
2. Implement `extractTextFromImageVision()` using existing Bedrock integration
3. Define medical document extraction prompt
4. Handle API errors with graceful fallback
5. Create unit tests with mocked Bedrock in `tests/unit/domains/referrals/vision-extraction.test.ts`

**Verification**:
```bash
npm run test -- tests/unit/domains/referrals/vision-extraction.test.ts
npm run typecheck
```

**Files Created**:
- `src/domains/referrals/vision-extraction.ts`
- `tests/unit/domains/referrals/vision-extraction.test.ts`

---

### [ ] Step: Expand MIME Type Constants

Update type definitions to support new file types.

**Tasks**:
1. Modify `src/domains/referrals/referral.types.ts`:
   - Expand `ALLOWED_REFERRAL_MIME_TYPES` array with new types
   - Add `ACCEPTED_REFERRAL_EXTENSIONS` constant for display
2. Ensure `isAllowedMimeType()` continues to work with expanded types
3. Add feature flag check helper

**Verification**:
```bash
npm run test -- tests/unit/domains/referrals/referral.types.test.ts
npm run typecheck
```

**Files Modified**:
- `src/domains/referrals/referral.types.ts`

---

### [ ] Step: Update Referral Service Text Extraction

Extend the text extraction logic to handle new file types.

**Tasks**:
1. Modify `src/domains/referrals/referral.service.ts`:
   - Update `getExtensionFromMimeType()` with new mappings
   - Extend `extractTextFromDocument()` with new type handlers:
     - Images → `extractTextFromImageVision()` after HEIC conversion
     - DOCX → `extractDocxText()`
     - RTF → Simple text extraction
2. Add feature flag check to `createReferralDocument()`
3. Import new utility modules
4. Update existing tests, add new test cases

**Verification**:
```bash
npm run test -- tests/unit/domains/referrals/referral.service.test.ts
npm run typecheck
```

**Files Modified**:
- `src/domains/referrals/referral.service.ts`

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
