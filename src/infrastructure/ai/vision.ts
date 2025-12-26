// src/infrastructure/ai/vision.ts
// Unified vision analysis service with provider switching

import {
  analyzeImage as analyzeImageAnthropic,
  analyzeMultipleImages as analyzeMultipleImagesAnthropic,
  fetchImageAsBase64 as fetchImageAsBase64Anthropic,
  type VisionRequest as AnthropicVisionRequest,
  type VisionResponse as AnthropicVisionResponse,
} from '@/infrastructure/anthropic';

import {
  analyzeImage as analyzeImageBedrock,
  analyzeMultipleImages as analyzeMultipleImagesBedrock,
  fetchImageAsBase64 as fetchImageAsBase64Bedrock,
  type VisionRequest as BedrockVisionRequest,
  type VisionResponse as BedrockVisionResponse,
} from '@/infrastructure/bedrock';

import { getCurrentProvider, type AIProvider } from './types';
import { logger } from '@/lib/logger';

/**
 * Supported image MIME types.
 */
export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

/**
 * Vision analysis request (provider-agnostic).
 */
export interface VisionRequest {
  imageBase64: string;
  mimeType: ImageMimeType;
  prompt: string;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
}

/**
 * Vision analysis response (provider-agnostic).
 */
export interface VisionResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  provider: AIProvider;
}

/**
 * Image data for multi-image analysis.
 */
export interface ImageData {
  base64: string;
  mimeType: ImageMimeType;
}

/**
 * Analyze an image using the configured AI provider.
 */
export async function analyzeImage(request: VisionRequest): Promise<VisionResponse> {
  const provider = getCurrentProvider();
  const log = logger.child({ action: 'analyzeImage', provider });

  log.debug('Starting image analysis', { provider });

  if (provider === 'anthropic') {
    const response = await analyzeImageAnthropic(request);

    return {
      content: response.content,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      stopReason: response.stopReason,
      provider: 'anthropic',
    };
  } else {
    const response = await analyzeImageBedrock(request);

    return {
      content: response.content,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      stopReason: response.stopReason,
      provider: 'bedrock',
    };
  }
}

/**
 * Analyze multiple images using the configured AI provider.
 */
export async function analyzeMultipleImages(
  images: ImageData[],
  prompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<VisionResponse> {
  const provider = getCurrentProvider();
  const log = logger.child({ action: 'analyzeMultipleImages', provider, pageCount: images.length });

  log.debug('Starting multi-image analysis', { provider, pageCount: images.length });

  if (provider === 'anthropic') {
    const response = await analyzeMultipleImagesAnthropic(images, prompt, options);

    return {
      content: response.content,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      stopReason: response.stopReason,
      provider: 'anthropic',
    };
  } else {
    const response = await analyzeMultipleImagesBedrock(images, prompt, options);

    return {
      content: response.content,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      stopReason: response.stopReason,
      provider: 'bedrock',
    };
  }
}

/**
 * Fetch and convert an image URL to base64.
 * Uses the same implementation regardless of provider.
 */
export async function fetchImageAsBase64(
  url: string
): Promise<{ base64: string; mimeType: ImageMimeType }> {
  // Both providers use the same fetch logic
  return fetchImageAsBase64Anthropic(url);
}
