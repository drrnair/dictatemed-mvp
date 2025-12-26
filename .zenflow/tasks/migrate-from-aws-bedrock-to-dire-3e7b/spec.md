# Technical Specification: Migrate from AWS Bedrock to Direct Anthropic API

## Assessment

**Difficulty: Medium**

This migration involves:
- Creating a new Anthropic client alongside existing Bedrock infrastructure
- Building a unified abstraction layer for provider switching
- Updating 8 domain service files to use the new unified interface
- Adding feature flag support for zero-downtime migration
- Updating 7+ test files with new mocks

The complexity is moderate because:
- The interfaces between Bedrock and Anthropic are similar (both use the same Claude models)
- The migration is non-breaking with feature flag support
- No database changes required
- Existing patterns are well-established

---

## Technical Context

### Language & Framework
- **Language**: TypeScript 5.3
- **Framework**: Next.js 14.2 (App Router)
- **Runtime**: Node.js 20+
- **Testing**: Vitest (unit), Playwright (e2e)

### Current Dependencies
```json
{
  "@aws-sdk/client-bedrock-runtime": "^3.500.0"
}
```

### New Dependencies
```json
{
  "@anthropic-ai/sdk": "^0.39.0"
}
```

### Current AWS Bedrock Infrastructure

**Location**: `src/infrastructure/bedrock/`

| File | Purpose |
|------|---------|
| `index.ts` | Unified exports for all Bedrock functionality |
| `types.ts` | Shared types, error handling, retry configs |
| `text-generation.ts` | Text generation (generateText, generateTextStream, generateTextWithRetry) |
| `vision.ts` | Image analysis (analyzeImage, analyzeMultipleImages) |
| `README.md` | Documentation |

### Key Interfaces to Preserve

```typescript
// Text Generation
interface TextGenerationRequest {
  prompt: string;
  modelId: ModelId;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  systemPrompt?: string;
}

interface TextGenerationResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  modelId: string;
  provider: AIProvider;  // NEW: Added field indicating which provider was used
}

// Vision
interface VisionRequest {
  imageBase64: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

interface VisionResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  provider: AIProvider;  // NEW: Added field indicating which provider was used
}
```

### Breaking Changes in Unified Layer

The unified AI layer introduces the following intentional breaking changes:

1. **Abstract Model IDs**: `MODELS.OPUS` and `MODELS.SONNET` now return abstract identifiers (`'opus'`, `'sonnet'`) instead of provider-specific model IDs. This is transparent to consuming code since all functions accept and handle these abstract IDs internally.

2. **Provider Field in Responses**: Both `TextGenerationResponse` and `VisionResponse` now include a `provider: AIProvider` field (`'anthropic' | 'bedrock'`) indicating which provider handled the request. Consuming code should handle this additional field gracefully (TypeScript will allow extra fields in object destructuring).

### Services Using Bedrock (8 files)

| Service | Import | Usage |
|---------|--------|-------|
| `src/domains/letters/letter.service.ts` | `generateTextWithRetry`, `ModelId` | Letter generation pipeline |
| `src/domains/letters/model-selection.ts` | `MODELS`, `estimateCost`, `estimateTokenCount` | Intelligent model routing |
| `src/domains/referrals/vision-extraction.ts` | `analyzeImage`, `VisionRequest` | OCR from referral images |
| `src/domains/referrals/referral-extraction.service.ts` | `generateTextWithRetry`, `MODELS` | Structured data extraction |
| `src/domains/referrals/referral-fast-extraction.service.ts` | `generateTextWithRetry`, `MODELS` | Fast patient ID extraction |
| `src/domains/style/style-analyzer.ts` | `generateTextWithRetry`, `MODELS` | Writing style analysis |
| `src/domains/style/learning-pipeline.ts` | `generateTextWithRetry`, `MODELS` | Style learning pipeline |
| `src/domains/documents/extraction.service.ts` | `analyzeImage`, `analyzeMultipleImages`, `fetchImageAsBase64` | Document extraction |

---

## Implementation Approach

### Strategy: Feature Flag with Unified Interface

1. **Create Anthropic client** - New `src/infrastructure/anthropic/` module
2. **Create unified AI interface** - New `src/infrastructure/ai/` abstraction layer
3. **Add feature flag** - `USE_ANTHROPIC_API` environment variable
4. **Update service imports** - Change from `@/infrastructure/bedrock` to `@/infrastructure/ai`
5. **Keep Bedrock code** - Retained for rollback capability
6. **Test both providers** - Verify parity before full migration

### Migration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Domain Services                              │
│  (letter.service, vision-extraction, referral-extraction, etc) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 src/infrastructure/ai/                          │
│   Unified Interface (text-generation.ts, vision.ts)            │
│   Feature Flag: USE_ANTHROPIC_API                              │
└─────────────────────────────────────────────────────────────────┘
                      │                    │
         ┌────────────┘                    └────────────┐
         ▼                                              ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│ src/infrastructure/     │               │ src/infrastructure/     │
│ anthropic/              │               │ bedrock/                │
│ (NEW - Direct API)      │               │ (EXISTING - Kept)       │
└─────────────────────────┘               └─────────────────────────┘
```

---

## Source Code Structure Changes

### New Files to Create

```
src/infrastructure/
├── anthropic/                    # NEW: Direct Anthropic API client
│   ├── index.ts                  # Exports
│   ├── client.ts                 # Anthropic SDK initialization
│   ├── text-generation.ts        # Text generation implementation
│   ├── vision.ts                 # Vision implementation
│   └── types.ts                  # Anthropic-specific error types
│
├── ai/                           # NEW: Unified abstraction layer
│   ├── index.ts                  # Unified exports
│   ├── text-generation.ts        # Provider-switching text generation
│   ├── vision.ts                 # Provider-switching vision
│   └── types.ts                  # Shared types
│
└── bedrock/                      # EXISTING: Keep for rollback
    ├── index.ts
    ├── text-generation.ts
    ├── vision.ts
    └── types.ts
```

### Files to Modify

| File | Change |
|------|--------|
| `.env.example` | Add `ANTHROPIC_API_KEY`, `USE_ANTHROPIC_API` |
| `package.json` | Add `@anthropic-ai/sdk` dependency |
| `src/domains/letters/letter.service.ts` | Update import path |
| `src/domains/letters/model-selection.ts` | Update import path |
| `src/domains/referrals/vision-extraction.ts` | Update import path |
| `src/domains/referrals/referral-extraction.service.ts` | Update import path |
| `src/domains/referrals/referral-fast-extraction.service.ts` | Update import path |
| `src/domains/style/style-analyzer.ts` | Update import path |
| `src/domains/style/learning-pipeline.ts` | Update import path |
| `src/domains/documents/extraction.service.ts` | Update import path |
| `tests/unit/domains/letters/model-selection.test.ts` | Update mock path |
| `tests/unit/domains/referrals/vision-extraction.test.ts` | Update mock path |
| `tests/unit/domains/referrals/referral-extraction.test.ts` | Update mock path |
| `tests/unit/domains/referrals/fast-patient-extraction.test.ts` | Update mock path |
| `tests/unit/domains/style/learning-pipeline.test.ts` | Update mock path |
| `tests/integration/style/learning-flow.test.ts` | Update mock path |
| `tests/integration/api/referrals.test.ts` | Update mock path |

---

## Data Model / API / Interface Changes

### No Database Changes
- The migration is stateless (AI provider is an external API)
- Token usage tracking already exists in database and works with both providers
- No Prisma migrations required

### Environment Variables

**Add to `.env.example`:**
```bash
# Anthropic API (Direct - recommended for global performance)
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Feature flag: Toggle between providers
# "true" = use Anthropic API (recommended)
# "false" = use AWS Bedrock (fallback)
USE_ANTHROPIC_API=true
```

### Model ID Mapping

| Provider | Opus Model ID | Sonnet Model ID |
|----------|---------------|-----------------|
| AWS Bedrock | `anthropic.claude-opus-4-20250514-v1:0` | `anthropic.claude-sonnet-4-20250514-v1:0` |
| Anthropic API | `claude-opus-4-20250514` | `claude-sonnet-4-20250514` |

### Interface Compatibility

The unified `src/infrastructure/ai/` layer will export:

```typescript
// Same interface as current Bedrock exports
export const MODELS = {
  OPUS: 'opus',      // Provider-agnostic identifier
  SONNET: 'sonnet',  // Provider-agnostic identifier
} as const;

export type ModelId = typeof MODELS[keyof typeof MODELS];

// Functions with same signatures
export function generateText(request: TextGenerationRequest): Promise<TextGenerationResponse>;
export function generateTextStream(request: TextGenerationRequest): AsyncGenerator<StreamChunk>;
export function generateTextWithRetry(request: TextGenerationRequest, options?: RetryOptions): Promise<TextGenerationResponse>;
export function analyzeImage(request: VisionRequest): Promise<VisionResponse>;
export function analyzeMultipleImages(images: ImageInput[], prompt: string, options?: VisionOptions): Promise<VisionResponse>;
export function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: MimeType }>;
export function estimateTokenCount(text: string): number;
export function estimateCost(modelId: ModelId, inputTokens: number, outputTokens: number): CostEstimate;
```

---

## Verification Approach

### Unit Tests
```bash
npm run test -- src/infrastructure/ai
npm run test -- src/infrastructure/anthropic
```

### Integration Tests
```bash
npm run test:integration
```

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
```

### Manual Verification
1. Set `USE_ANTHROPIC_API=true` in `.env.local`
2. Run the development server: `npm run dev`
3. Test document upload and extraction
4. Test letter generation
5. Verify token usage is logged correctly
6. Compare response quality with Bedrock

### Performance Benchmarking
1. Measure latency for text generation (target: < 2s)
2. Measure latency for vision analysis (target: < 3s)
3. Compare against Bedrock baseline
4. Test from multiple regions (AU, US, EU)

---

## Implementation Plan

### Step 1: Setup & Infrastructure
- [ ] Install `@anthropic-ai/sdk` dependency
- [ ] Update `.env.example` with new environment variables
- [ ] Create `src/infrastructure/anthropic/` module structure

### Step 2: Create Anthropic Client
- [ ] Create `src/infrastructure/anthropic/client.ts` with SDK initialization
- [ ] Create `src/infrastructure/anthropic/types.ts` with error handling
- [ ] Create `src/infrastructure/anthropic/text-generation.ts`
- [ ] Create `src/infrastructure/anthropic/vision.ts`
- [ ] Create `src/infrastructure/anthropic/index.ts` exports

### Step 3: Create Unified AI Layer
- [ ] Create `src/infrastructure/ai/types.ts` with shared types
- [ ] Create `src/infrastructure/ai/text-generation.ts` with provider switching
- [ ] Create `src/infrastructure/ai/vision.ts` with provider switching
- [ ] Create `src/infrastructure/ai/index.ts` exports

### Step 4: Migrate Domain Services
- [ ] Update `src/domains/letters/letter.service.ts` imports
- [ ] Update `src/domains/letters/model-selection.ts` imports
- [ ] Update `src/domains/referrals/vision-extraction.ts` imports
- [ ] Update `src/domains/referrals/referral-extraction.service.ts` imports
- [ ] Update `src/domains/referrals/referral-fast-extraction.service.ts` imports
- [ ] Update `src/domains/style/style-analyzer.ts` imports
- [ ] Update `src/domains/style/learning-pipeline.ts` imports
- [ ] Update `src/domains/documents/extraction.service.ts` imports

### Step 5: Update Tests
- [ ] Update all test mocks to use `@/infrastructure/ai`
- [ ] Add unit tests for Anthropic client
- [ ] Add unit tests for unified AI layer
- [ ] Verify all existing tests pass

### Step 6: Verification & Documentation
- [ ] Run full test suite
- [ ] Manual testing with both providers
- [ ] Performance benchmarking
- [ ] Update documentation

---

## Rollback Plan

### Instant Rollback (< 30 seconds)
1. Set `USE_ANTHROPIC_API=false` in environment
2. Redeploy or restart application
3. Verify traffic flows through Bedrock

### Full Rollback (if needed)
1. Revert service imports to `@/infrastructure/bedrock`
2. Remove `@anthropic-ai/sdk` dependency
3. Remove `src/infrastructure/anthropic/` and `src/infrastructure/ai/`
4. Deploy changes

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| API key exposure | High | Use environment variables, never commit secrets |
| Rate limiting | Medium | Implement retry logic with exponential backoff |
| Response format differences | Low | Test thoroughly, unified layer handles translation |
| Cost overrun | Medium | Monitor token usage, set alerts |
| Performance regression | Medium | Benchmark before full migration |

---

## Success Criteria

- [ ] All existing tests pass
- [ ] Feature flag allows instant provider switching
- [ ] No breaking changes to domain services
- [ ] Latency targets met (text: < 2s, vision: < 3s)
- [ ] Zero downtime during migration
- [ ] Documentation updated
