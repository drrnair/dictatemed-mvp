# Spec and build

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification

**Completed:** Technical specification created at `.zenflow/tasks/migrate-from-aws-bedrock-to-dire-3e7b/spec.md`

**Assessment:** Medium difficulty
- Creating a new Anthropic client alongside existing Bedrock infrastructure
- Building a unified abstraction layer for provider switching
- Updating 6 domain service files
- Adding feature flag support for zero-downtime migration

---

### [x] Step 1: Setup & Dependencies

Install the Anthropic SDK and update environment configuration.

**Tasks:**
1. Add `@anthropic-ai/sdk` to package.json dependencies
2. Update `.env.example` with `ANTHROPIC_API_KEY` and `USE_ANTHROPIC_API` variables

**Verification:**
- `npm install` succeeds
- `npm run typecheck` passes

**Completed:**
- Added `@anthropic-ai/sdk@^0.39.0` to package.json dependencies
- Updated `.env.example` with `USE_ANTHROPIC_API` and `ANTHROPIC_API_KEY` variables
- All verifications passed

---

### [x] Step 2: Create Anthropic Client Module
<!-- chat-id: 3cdd8e76-fb68-44fb-95a4-7de6dc730de6 -->

Create the direct Anthropic API client in `src/infrastructure/anthropic/`.

**Tasks:**
1. Create `src/infrastructure/anthropic/types.ts` - Error types and retry configs
2. Create `src/infrastructure/anthropic/client.ts` - SDK initialization
3. Create `src/infrastructure/anthropic/text-generation.ts` - Text generation functions
4. Create `src/infrastructure/anthropic/vision.ts` - Image analysis functions
5. Create `src/infrastructure/anthropic/index.ts` - Unified exports

**Verification:**
- `npm run typecheck` passes
- `npm run lint` passes

**Completed:**
- Created all 5 files in `src/infrastructure/anthropic/`:
  - `types.ts` - AnthropicError types, RetryConfig, parseAnthropicError(), calculateBackoffDelay()
  - `client.ts` - Singleton Anthropic SDK client with getAnthropicClient(), verifyAnthropicConnection()
  - `text-generation.ts` - generateText(), generateTextStream(), generateTextWithRetry(), estimateTokenCount(), estimateCost()
  - `vision.ts` - analyzeImage(), analyzeMultipleImages(), fetchImageAsBase64()
  - `index.ts` - Unified exports matching Bedrock interface pattern
- All verifications passed: `npm run typecheck` and `npm run lint` succeed

---

### [x] Step 3: Create Unified AI Layer
<!-- chat-id: f378496d-4dbb-4a27-aa9c-da5020ebf349 -->

Create the provider-switching abstraction layer in `src/infrastructure/ai/`.

**Tasks:**
1. Create `src/infrastructure/ai/types.ts` - Shared types for both providers
2. Create `src/infrastructure/ai/text-generation.ts` - Provider-switching text generation
3. Create `src/infrastructure/ai/vision.ts` - Provider-switching vision
4. Create `src/infrastructure/ai/index.ts` - Unified exports matching Bedrock interface

**Verification:**
- `npm run typecheck` passes
- `npm run lint` passes
- Exports provide same function signatures as Bedrock (with provider-agnostic interface)
- MODELS uses abstract IDs (`'opus'`, `'sonnet'`) that are mapped internally

**Completed:**
- Created all 4 files in `src/infrastructure/ai/`:
  - `types.ts` - AIProvider type, AIError types, unified RetryConfig, parseAIError(), calculateBackoffDelay(), getCurrentProvider()
  - `text-generation.ts` - Provider-switching generateText(), generateTextStream(), generateTextWithRetry(), estimateTokenCount(), estimateCost() with abstract ModelId ('opus'|'sonnet')
  - `vision.ts` - Provider-switching analyzeImage(), analyzeMultipleImages(), fetchImageAsBase64()
  - `index.ts` - Unified exports that match Bedrock interface for drop-in replacement
- Feature: `getCurrentProvider()` reads `USE_ANTHROPIC_API` env var to determine active provider
- Feature: Abstract model IDs (`'opus'`, `'sonnet'`) mapped to provider-specific IDs internally
- All verifications passed: `npm run typecheck` and `npm run lint` succeed

---

### [x] Step 4: Migrate Domain Services
<!-- chat-id: ab8fdeef-1f9f-4960-81ee-cc7ac6884a15 -->

Update all domain services to use the unified AI layer.

**Tasks:**
1. Update `src/domains/letters/letter.service.ts` - Change import from `@/infrastructure/bedrock` to `@/infrastructure/ai`
2. Update `src/domains/letters/model-selection.ts` - Change import path
3. Update `src/domains/referrals/vision-extraction.ts` - Change import path
4. Update `src/domains/referrals/referral-extraction.service.ts` - Change import path
5. Update `src/domains/referrals/referral-fast-extraction.service.ts` - Change import path
6. Update `src/domains/style/style-analyzer.ts` - Change import path
7. Update `src/domains/style/learning-pipeline.ts` - Change import path
8. Update `src/domains/documents/extraction.service.ts` - Change import path

**Verification:**
- `npm run typecheck` passes
- `npm run lint` passes

**Completed:**
- Updated all 8 domain service files to import from `@/infrastructure/ai` instead of `@/infrastructure/bedrock`:
  - `src/domains/letters/letter.service.ts` - imports `generateTextWithRetry`, `ModelId`
  - `src/domains/letters/model-selection.ts` - imports `MODELS`, `ModelId`, `estimateCost`, `estimateTokenCount`
  - `src/domains/referrals/vision-extraction.ts` - imports `analyzeImage`, `VisionRequest`
  - `src/domains/referrals/referral-extraction.service.ts` - imports `generateTextWithRetry`, `MODELS`
  - `src/domains/referrals/referral-fast-extraction.service.ts` - imports `generateTextWithRetry`, `MODELS`
  - `src/domains/style/style-analyzer.ts` - imports `generateTextWithRetry`, `MODELS`
  - `src/domains/style/learning-pipeline.ts` - imports `generateTextWithRetry`, `MODELS`
  - `src/domains/documents/extraction.service.ts` - imports `analyzeImage`, `analyzeMultipleImages`, `fetchImageAsBase64`
- Updated `vision-extraction.ts` comment to remove Bedrock reference
- All verifications passed: `npm run typecheck` and `npm run lint` succeed
- Zero bedrock imports remaining in `src/domains/`

---

### [ ] Step 5: Update Tests

Update all test files to mock the new unified AI layer.

**Tasks:**
1. Update `tests/unit/domains/letters/model-selection.test.ts` - Update mock path
2. Update `tests/unit/domains/referrals/vision-extraction.test.ts` - Update mock path
3. Update `tests/unit/domains/referrals/referral-extraction.test.ts` - Update mock path
4. Update `tests/unit/domains/referrals/fast-patient-extraction.test.ts` - Update mock path
5. Update `tests/unit/domains/style/learning-pipeline.test.ts` - Update mock path
6. Update `tests/integration/style/learning-flow.test.ts` - Update mock path
7. Update `tests/integration/api/referrals.test.ts` - Update mock path

**Verification:**
- `npm run test` passes (all unit tests)
- `npm run test:integration` passes (all integration tests)

---

### [ ] Step 6: Final Verification & Report

Run full verification and create implementation report.

**Tasks:**
1. Run full test suite: `npm run verify`
2. Verify feature flag switching works (USE_ANTHROPIC_API=true/false)
3. Create report at `.zenflow/tasks/migrate-from-aws-bedrock-to-dire-3e7b/report.md`

**Verification:**
- `npm run verify` passes
- Feature flag correctly switches between providers
- Report documents implementation and testing
