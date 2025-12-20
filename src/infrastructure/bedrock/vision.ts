// src/infrastructure/bedrock/vision.ts
// Claude Vision client for document processing via AWS Bedrock

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { logger } from '@/lib/logger';

// Claude Sonnet 4 for vision tasks (cost-effective for document extraction)
const VISION_MODEL_ID = process.env.BEDROCK_VISION_MODEL_ID ?? 'anthropic.claude-sonnet-4-20250514-v1:0';
const AWS_REGION = process.env.AWS_REGION ?? 'ap-southeast-2';

// Singleton client
let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: AWS_REGION,
      // Credentials from environment or IAM role
    });
  }
  return bedrockClient;
}

export interface VisionRequest {
  imageBase64: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  prompt: string;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
}

export interface VisionResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

/**
 * Analyze an image using Claude Vision.
 */
export async function analyzeImage(request: VisionRequest): Promise<VisionResponse> {
  const log = logger.child({ action: 'analyzeImage' });

  const client = getBedrockClient();

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: request.mimeType,
              data: request.imageBase64,
            },
          },
          {
            type: 'text',
            text: request.prompt,
          },
        ],
      },
    ],
  };

  try {
    const command = new InvokeModelCommand({
      modelId: VISION_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    log.info('Vision analysis complete', {
      inputTokens: responseBody.usage?.input_tokens,
      outputTokens: responseBody.usage?.output_tokens,
      stopReason: responseBody.stop_reason,
    });

    return {
      content: responseBody.content?.[0]?.text ?? '',
      inputTokens: responseBody.usage?.input_tokens ?? 0,
      outputTokens: responseBody.usage?.output_tokens ?? 0,
      stopReason: responseBody.stop_reason ?? 'end_turn',
    };
  } catch (error) {
    log.error('Vision analysis failed', {}, error instanceof Error ? error : undefined);
    throw error;
  }
}

/**
 * Analyze multiple images (e.g., multi-page PDF converted to images).
 */
export async function analyzeMultipleImages(
  images: Array<{ base64: string; mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' }>,
  prompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<VisionResponse> {
  const log = logger.child({ action: 'analyzeMultipleImages', pageCount: images.length });

  const client = getBedrockClient();

  // Build content array with all images
  const content: Array<{
    type: 'image' | 'text';
    source?: { type: 'base64'; media_type: string; data: string };
    text?: string;
  }> = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img) continue;

    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mimeType,
        data: img.base64,
      },
    });

    // Add page separator text
    if (i < images.length - 1) {
      content.push({
        type: 'text',
        text: `--- End of page ${i + 1} ---`,
      });
    }
  }

  // Add the prompt at the end
  content.push({
    type: 'text',
    text: prompt,
  });

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  };

  try {
    const command = new InvokeModelCommand({
      modelId: VISION_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    log.info('Multi-image vision analysis complete', {
      pageCount: images.length,
      inputTokens: responseBody.usage?.input_tokens,
      outputTokens: responseBody.usage?.output_tokens,
    });

    return {
      content: responseBody.content?.[0]?.text ?? '',
      inputTokens: responseBody.usage?.input_tokens ?? 0,
      outputTokens: responseBody.usage?.output_tokens ?? 0,
      stopReason: responseBody.stop_reason ?? 'end_turn',
    };
  } catch (error) {
    log.error('Multi-image vision analysis failed', {}, error instanceof Error ? error : undefined);
    throw error;
  }
}

/**
 * Fetch and convert an image URL to base64.
 */
export async function fetchImageAsBase64(
  url: string
): Promise<{ base64: string; mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' }> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? 'image/png';
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  // Normalize MIME type
  let mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' = 'image/png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    mimeType = 'image/jpeg';
  } else if (contentType.includes('gif')) {
    mimeType = 'image/gif';
  } else if (contentType.includes('webp')) {
    mimeType = 'image/webp';
  }

  return { base64, mimeType };
}
