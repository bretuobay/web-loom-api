/**
 * Cloudflare Workers AI integration helper for Web Loom API Framework
 */
import type {
  AiBinding,
  TextGenerationOptions,
  TextGenerationResult,
  TextEmbeddingResult,
  ImageClassificationResult,
} from './types';

/**
 * Helper class wrapping the Cloudflare Workers AI binding.
 * Provides typed methods for common AI tasks.
 *
 * @example
 * ```ts
 * const ai = new WorkersAIHelper(env.AI);
 * const result = await ai.textGeneration('Summarize this article...', {
 *   maxTokens: 256,
 * });
 * ```
 */
export class WorkersAIHelper {
  constructor(private readonly ai: AiBinding) {}

  /**
   * Run an arbitrary AI model with the given inputs.
   */
  async run<T = unknown>(model: string, inputs: Record<string, unknown>): Promise<T> {
    return this.ai.run(model, inputs) as Promise<T>;
  }

  /**
   * Generate text from a prompt using a language model.
   */
  async textGeneration(
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<TextGenerationResult> {
    const { maxTokens, temperature, topP, stream = false } = options;
    const inputs: Record<string, unknown> = {
      prompt,
      ...(maxTokens !== undefined && { max_tokens: maxTokens }),
      ...(temperature !== undefined && { temperature }),
      ...(topP !== undefined && { top_p: topP }),
      stream,
    };
    return this.run<TextGenerationResult>('@cf/meta/llama-2-7b-chat-int8', inputs);
  }

  /**
   * Generate text embeddings for semantic search or similarity.
   */
  async textEmbedding(text: string | string[]): Promise<TextEmbeddingResult> {
    const input = Array.isArray(text) ? text : [text];
    return this.run<TextEmbeddingResult>('@cf/baai/bge-base-en-v1.5', { text: input });
  }

  /**
   * Classify an image using a vision model.
   */
  async imageClassification(image: ArrayBuffer | number[]): Promise<ImageClassificationResult[]> {
    return this.run<ImageClassificationResult[]>('@cf/microsoft/resnet-50', { image });
  }
}
