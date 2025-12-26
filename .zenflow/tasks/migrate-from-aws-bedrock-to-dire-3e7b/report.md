# Migration Report: AWS Bedrock to Direct Anthropic API

**Task ID:** migrate-from-aws-bedrock-to-dire-3e7b
**Completion Date:** 2025-12-27
**Status:** Implementation Complete

---

## Summary

Successfully migrated DictateMED from AWS Bedrock to support direct Anthropic API. The implementation uses a unified AI abstraction layer with feature flag switching, enabling zero-downtime migration and instant rollback capability.

---

## Implementation Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Domain Services                          │
│  (letters, referrals, documents, style)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ import from @/infrastructure/ai
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Unified AI Layer (@/infrastructure/ai)          │
│  - text-generation.ts (generateText, generateTextWithRetry) │
│  - vision.ts (analyzeImage, analyzeMultipleImages)          │
│  - types.ts (AIProvider, getCurrentProvider)                │
│  - index.ts (unified exports)                               │
└─────────┬───────────────────────────────────┬───────────────┘
          │ USE_ANTHROPIC_API=true            │ USE_ANTHROPIC_API=false
          ▼                                   ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│ Anthropic SDK           │     │ AWS Bedrock SDK             │
│ (@/infrastructure/      │     │ (@/infrastructure/bedrock)  │
│  anthropic)             │     │                             │
└─────────────────────────┘     └─────────────────────────────┘
```

### Feature Flag

The provider is selected at runtime via the `USE_ANTHROPIC_API` environment variable:

| Value | Provider |
|-------|----------|
| `true` | Direct Anthropic API |
| `false` (default) | AWS Bedrock |

---

## Files Created

### 1. Anthropic Client Module (`src/infrastructure/anthropic/`)

| File | Purpose |
|------|---------|
| `types.ts` | AnthropicError types, RetryConfig, parseAnthropicError(), calculateBackoffDelay() |
| `client.ts` | Singleton Anthropic SDK client with getAnthropicClient(), verifyAnthropicConnection() |
| `text-generation.ts` | generateText(), generateTextStream(), generateTextWithRetry(), estimateTokenCount(), estimateCost() |
| `vision.ts` | analyzeImage(), analyzeMultipleImages(), fetchImageAsBase64() |
| `index.ts` | Unified exports matching Bedrock interface pattern |

### 2. Unified AI Layer (`src/infrastructure/ai/`)

| File | Purpose |
|------|---------|
| `types.ts` | AIProvider type, AIError types, unified RetryConfig, parseAIError(), calculateBackoffDelay(), getCurrentProvider() |
| `text-generation.ts` | Provider-switching generateText(), generateTextStream(), generateTextWithRetry() with abstract ModelId ('opus'\|'sonnet') |
| `vision.ts` | Provider-switching analyzeImage(), analyzeMultipleImages(), fetchImageAsBase64() |
| `index.ts` | Unified exports for drop-in replacement |

---

## Files Modified

### Domain Services (Import Path Changes)

| File | Change |
|------|--------|
| `src/domains/letters/letter.service.ts` | `@/infrastructure/bedrock` → `@/infrastructure/ai` |
| `src/domains/letters/model-selection.ts` | `@/infrastructure/bedrock` → `@/infrastructure/ai` |
| `src/domains/referrals/vision-extraction.ts` | `@/infrastructure/bedrock/vision` → `@/infrastructure/ai` |
| `src/domains/referrals/referral-extraction.service.ts` | `@/infrastructure/bedrock` → `@/infrastructure/ai` |
| `src/domains/referrals/referral-fast-extraction.service.ts` | `@/infrastructure/bedrock` → `@/infrastructure/ai` |
| `src/domains/style/style-analyzer.ts` | `@/infrastructure/bedrock` → `@/infrastructure/ai` |
| `src/domains/style/learning-pipeline.ts` | `@/infrastructure/bedrock` → `@/infrastructure/ai` |
| `src/domains/documents/extraction.service.ts` | `@/infrastructure/bedrock` → `@/infrastructure/ai` |

### Test Files (Mock Path Changes)

| File | Change |
|------|--------|
| `tests/unit/domains/letters/model-selection.test.ts` | Updated mock to `@/infrastructure/ai` |
| `tests/unit/domains/referrals/vision-extraction.test.ts` | Updated mock to `@/infrastructure/ai/vision` |
| `tests/unit/domains/referrals/referral-extraction.test.ts` | Updated mock to `@/infrastructure/ai` |
| `tests/unit/domains/referrals/fast-patient-extraction.test.ts` | Updated mock to `@/infrastructure/ai`, added `provider` field |
| `tests/unit/domains/style/learning-pipeline.test.ts` | Updated mock to `@/infrastructure/ai` |
| `tests/integration/style/learning-flow.test.ts` | Updated mock to `@/infrastructure/ai` |
| `tests/integration/api/referrals.test.ts` | Updated mock to `@/infrastructure/ai` |

### Configuration Files

| File | Change |
|------|--------|
| `package.json` | Added `@anthropic-ai/sdk@^0.39.0` dependency |
| `.env.example` | Added `USE_ANTHROPIC_API` and `ANTHROPIC_API_KEY` variables |

---

## Verification Results

### npm run verify

```
✓ Lint: Passed (3 warnings - pre-existing, unrelated to migration)
✓ Typecheck: Passed
✓ Tests: 61 test files, 1783 tests passed
```

### Feature Flag Verification

```
USE_ANTHROPIC_API=undefined -> bedrock (✓)
USE_ANTHROPIC_API=""        -> bedrock (✓)
USE_ANTHROPIC_API="false"   -> bedrock (✓)
USE_ANTHROPIC_API="true"    -> anthropic (✓)
```

---

## Deployment Guide

### Step 1: Add Environment Variables

```bash
# Required for Anthropic API
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Feature flag (start with false for safety)
USE_ANTHROPIC_API=false
```

### Step 2: Deploy Code

Deploy the updated code to staging/production. The feature flag defaults to `false` (Bedrock), so no behavior change until enabled.

### Step 3: Enable Anthropic API

```bash
USE_ANTHROPIC_API=true
```

### Step 4: Monitor

- Check application logs for provider in use
- Monitor latency metrics
- Verify extraction and generation quality

### Instant Rollback

If issues occur, set `USE_ANTHROPIC_API=false` and restart the application. No code deployment required.

---

## Abstract Model IDs

The unified layer uses abstract model identifiers that are mapped internally:

| Abstract ID | Anthropic | Bedrock |
|-------------|-----------|---------|
| `opus` | `claude-opus-4-20250514` | `anthropic.claude-opus-4-20250514-v1:0` |
| `sonnet` | `claude-sonnet-4-20250514` | `anthropic.claude-sonnet-4-20250514-v1:0` |

This allows domain services to use model IDs without provider awareness.

---

## Response Type Changes

The unified layer adds a `provider` field to responses:

```typescript
interface TextGenerationResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  modelId: string;
  provider: 'anthropic' | 'bedrock';  // NEW
}

interface VisionResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  provider: 'anthropic' | 'bedrock';  // NEW
}
```

---

## Future Cleanup (After Migration Verified)

Once the Anthropic API has been running stably in production for 2+ weeks:

1. Remove AWS Bedrock dependency: `npm uninstall @aws-sdk/client-bedrock-runtime`
2. Delete `src/infrastructure/bedrock/` directory
3. Simplify `src/infrastructure/ai/` to call Anthropic directly
4. Remove AWS-related environment variables from `.env.example`

---

## Benefits Achieved

| Benefit | Status |
|---------|--------|
| Zero-downtime migration | ✓ Feature flag enables instant switching |
| Instant rollback capability | ✓ `USE_ANTHROPIC_API=false` reverts to Bedrock |
| Global performance improvement | Ready for testing |
| Simplified infrastructure | Ready after cleanup phase |
| Cost savings potential | Ready for measurement |

---

## Notes

- The Anthropic SDK is initialized lazily on first use when `USE_ANTHROPIC_API=true`
- Both providers use identical retry logic with exponential backoff
- Token counting and cost estimation remain consistent across providers
- All existing tests pass without modification to test logic (only mock paths changed)
