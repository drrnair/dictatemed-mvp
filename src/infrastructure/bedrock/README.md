# AWS Bedrock Integration

This module provides integration with AWS Bedrock for Claude model invocations.

## Overview

The Bedrock infrastructure supports two primary use cases:

1. **Vision** (`vision.ts`) - Document extraction using Claude Vision
2. **Text Generation** (`text-generation.ts`) - Letter generation using Claude text models

## Models

### Vision
- **Claude Sonnet 4** (`anthropic.claude-sonnet-4-20250514-v1:0`)
  - Used for: Document extraction (echo reports, angiogram reports, etc.)
  - Cost-effective for vision tasks
  - 4096 max output tokens

### Text Generation
- **Claude Opus 4** (`anthropic.claude-opus-4-20250514-v1:0`)
  - Used for: Complex letter generation (new patients, complex procedures)
  - Highest quality, most expensive
  - 8192 max output tokens (configurable up to 200k)

- **Claude Sonnet 4** (`anthropic.claude-sonnet-4-20250514-v1:0`)
  - Used for: Routine letter generation (follow-ups, simple reports)
  - Balanced quality and cost
  - 8192 max output tokens (configurable up to 200k)

## Configuration

Environment variables:

```env
AWS_REGION=ap-southeast-2
BEDROCK_OPUS_MODEL_ID=anthropic.claude-opus-4-20250514-v1:0
BEDROCK_SONNET_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
BEDROCK_VISION_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
```

AWS credentials are sourced from:
1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. IAM role (recommended for production)

## Usage

### Text Generation (Letter Generation)

```typescript
import { generateText, MODELS } from '@/infrastructure/bedrock';

const response = await generateText({
  prompt: 'Generate a follow-up letter for...',
  modelId: MODELS.SONNET,
  maxTokens: 4096,
  temperature: 0.3,
  systemPrompt: 'You are a cardiology letter assistant...',
});

console.log(response.content);
console.log(`Tokens: ${response.inputTokens} in, ${response.outputTokens} out`);
```

### Streaming Text Generation

```typescript
import { generateTextStream, MODELS } from '@/infrastructure/bedrock';

const stream = generateTextStream({
  prompt: 'Generate a new patient consultation letter...',
  modelId: MODELS.OPUS,
  maxTokens: 8192,
});

for await (const chunk of stream) {
  if (chunk.type === 'content_delta') {
    process.stdout.write(chunk.delta ?? '');
  } else if (chunk.type === 'message_stop') {
    console.log(`\n\nTotal tokens: ${chunk.usage?.outputTokens}`);
  }
}
```

### With Retry Logic

```typescript
import { generateTextWithRetry, MODELS } from '@/infrastructure/bedrock';

const response = await generateTextWithRetry(
  {
    prompt: 'Generate letter...',
    modelId: MODELS.SONNET,
  },
  {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  }
);
```

### Vision (Document Extraction)

```typescript
import { analyzeImage } from '@/infrastructure/bedrock';

const response = await analyzeImage({
  imageBase64: base64String,
  mimeType: 'image/png',
  prompt: 'Extract echo report data...',
  maxTokens: 4096,
  temperature: 0,
});

console.log(response.content);
```

### Multi-page Document Processing

```typescript
import { analyzeMultipleImages } from '@/infrastructure/bedrock';

const response = await analyzeMultipleImages(
  [
    { base64: page1Base64, mimeType: 'image/png' },
    { base64: page2Base64, mimeType: 'image/png' },
  ],
  'Extract all echo measurements from this multi-page report...',
  { maxTokens: 4096 }
);
```

## Error Handling

The module provides structured error handling with retry logic:

```typescript
import { parseBedrockError, DEFAULT_RETRY_CONFIG } from '@/infrastructure/bedrock';

try {
  const response = await generateText({...});
} catch (error) {
  const bedrockError = parseBedrockError(error);

  if (bedrockError.type === 'ThrottlingException') {
    // Handle rate limiting
    console.log('Rate limited, retry recommended');
  } else if (!bedrockError.retryable) {
    // Don't retry validation errors
    console.error('Non-retryable error:', bedrockError.message);
  }
}
```

## Cost Estimation

```typescript
import { estimateCost, estimateTokenCount, MODELS } from '@/infrastructure/bedrock';

const prompt = 'Generate a letter...';
const estimatedInputTokens = estimateTokenCount(prompt);

// Estimate cost before generation
const estimate = estimateCost(MODELS.OPUS, estimatedInputTokens, 2000);
console.log(`Estimated cost: $${estimate.totalCost.toFixed(4)}`);

// Calculate actual cost after generation
const response = await generateText({...});
const actualCost = estimateCost(
  MODELS.OPUS,
  response.inputTokens,
  response.outputTokens
);
console.log(`Actual cost: $${actualCost.totalCost.toFixed(4)}`);
```

## Pricing (as of 2025)

### Claude Opus 4
- Input: $15 per 1M tokens
- Output: $75 per 1M tokens

### Claude Sonnet 4
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens

Example cost for typical new patient letter:
- Input: 5,000 tokens (sources + prompt)
- Output: 2,000 tokens (letter)
- Opus cost: $0.23
- Sonnet cost: $0.05

## Rate Limits

Bedrock rate limits (per region, per account):
- **Requests per minute**: Varies by model (typically 100-1000)
- **Tokens per minute**: Varies by model (typically 100k-400k)

The module implements exponential backoff retry for `ThrottlingException` errors.

## Best Practices

1. **Model Selection**
   - Use Opus for complex, high-stakes letters (new patients, complex procedures)
   - Use Sonnet for routine letters (follow-ups, simple reports)
   - Use Vision Sonnet for all document extraction

2. **Token Management**
   - Use `estimateTokenCount()` for pre-flight checks
   - Set appropriate `maxTokens` based on expected output length
   - Monitor actual usage vs estimates

3. **Error Handling**
   - Always use retry logic for production code
   - Log token usage and costs for monitoring
   - Handle throttling gracefully with exponential backoff

4. **Streaming**
   - Use streaming for long-form content (letters > 2000 tokens)
   - Provides better UX with real-time progress
   - Allows early cancellation if needed

5. **Security**
   - Never log prompts containing PHI
   - Use IAM roles instead of access keys in production
   - Rotate credentials regularly

## Testing

```typescript
// Mock for tests
jest.mock('@/infrastructure/bedrock', () => ({
  generateText: jest.fn().mockResolvedValue({
    content: 'Mock letter content...',
    inputTokens: 1000,
    outputTokens: 500,
    stopReason: 'end_turn',
    modelId: 'mock-model',
  }),
}));
```

## Monitoring

Key metrics to track:
- Total tokens consumed (input + output)
- Cost per letter type
- Average generation time
- Error rates by type
- Model usage distribution (Opus vs Sonnet)

## Migration Notes

From Phase 3 vision.ts:
- Vision client remains unchanged
- Text generation client follows same pattern
- Shared types in `types.ts`
- Unified exports from `index.ts`
