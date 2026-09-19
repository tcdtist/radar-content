import { ILlmClient } from './translator';

export interface WorkersAiClientOptions {
  ai: any;
  model?: string;
  models?: string[];
  maxRetries?: number;
}

export const DEFAULT_WORKERS_AI_MODELS: readonly string[] = [
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/qwen/qwen2.5-coder-32b-instruct',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
];

export class WorkersAiClient implements ILlmClient {
  private ai: any;
  private models: string[];

  constructor(options: WorkersAiClientOptions) {
    this.ai = options.ai;
    const baseList = options.models && options.models.length > 0
      ? options.models
      : options.model
        ? [options.model, ...DEFAULT_WORKERS_AI_MODELS]
        : [...DEFAULT_WORKERS_AI_MODELS];

    this.models = Array.from(new Set(baseList.filter(Boolean)));
  }

  async generateJsonContent(systemPrompt: string, userPrompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (const model of this.models) {
      try {
        const response = await this.ai.run(model, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 4096,
        });

        // Cloudflare Workers AI standard response shape: { response: string }
        const text =
          typeof response === 'string'
            ? response
            : response?.response || response?.result?.response || response?.text || '';

        if (text && typeof text === 'string' && text.trim().length > 0) {
          return text.trim();
        }

        throw new Error(`Workers AI model '${model}' returned empty text`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[WorkersAiClient] Model '${model}' failed:`, lastError.message);
      }
    }

    throw lastError || new Error('Failed to generate content across all candidate Workers AI models');
  }
}
