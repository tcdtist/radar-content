import { GeminiContentResponse } from './llm-types';

export const DEFAULT_TIERED_MODELS: readonly string[] = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
];

export interface GeminiClientOptions {
  apiKey: string;
  model?: string;
  models?: string[];
  maxRetries?: number;
}

export class GeminiClient {
  private apiKey: string;
  private models: string[];
  private maxRetriesPerModel: number;

  constructor(options: GeminiClientOptions) {
    this.apiKey = options.apiKey;
    this.maxRetriesPerModel = options.maxRetries ?? 2;

    const baseList = options.models && options.models.length > 0
      ? options.models
      : options.model
        ? [options.model, ...DEFAULT_TIERED_MODELS]
        : [...DEFAULT_TIERED_MODELS];

    this.models = Array.from(new Set(baseList.filter(Boolean)));
  }

  getActiveModels(): string[] {
    return [...this.models];
  }

  async generateJsonContent(systemPrompt: string, userPrompt: string): Promise<string> {
    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    };

    let lastError: Error | null = null;

    for (const model of this.models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

      let attempt = 0;
      let shouldRotate = false;

      while (attempt < this.maxRetriesPerModel && !shouldRotate) {
        attempt++;
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (response.status === 404) {
            console.warn(`[GeminiClient] Model '${model}' HTTP 404. Rotating to next tier...`);
            shouldRotate = true;
            break;
          }

          if (response.status === 429) {
            if (attempt < this.maxRetriesPerModel) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
              continue;
            } else {
              console.warn(`[GeminiClient] Model '${model}' quota exhausted (HTTP 429). Rotating to next tier...`);
              shouldRotate = true;
              break;
            }
          }

          if (response.status >= 500) {
            if (attempt < this.maxRetriesPerModel) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
              continue;
            } else {
              console.warn(`[GeminiClient] Model '${model}' server error HTTP ${response.status}. Rotating...`);
              shouldRotate = true;
              break;
            }
          }

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API HTTP ${response.status}: ${errText}`);
          }

          const data = (await response.json()) as GeminiContentResponse;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!text) {
            throw new Error(`Gemini API response from '${model}' did not contain candidate text`);
          }

          return text;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt >= this.maxRetriesPerModel) {
            shouldRotate = true;
          }
        }
      }
    }

    throw lastError || new Error('Failed to generate content across all candidate Gemini models');
  }
}
