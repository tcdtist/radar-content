import { CardToTranslate } from '../lib/llm/translation-prompt';
import { CardTranslator, TranslatedCardContent } from '../lib/llm/translator';
import { GeminiClient } from '../lib/llm/gemini-client';
import { WorkersAiClient } from '../lib/llm/workers-ai-client';
import { WorkerEnv } from './pipeline';

/**
 * Execute card translation using Gemini with resilient fallback to Cloudflare Workers AI.
 * Solves the Cloudflare Edge IP location restriction issue (e.g. HKG datacenter 400 FAILED_PRECONDITION).
 */
export async function executeCardTranslation(
  env: WorkerEnv,
  card: CardToTranslate
): Promise<TranslatedCardContent> {
  const apiKey = env.GEMINI_TRANSLATION_KEY || env.GEMINI_API_KEY;
  let geminiError: string | null = null;

  // 1. Attempt Gemini translation if key is configured
  if (apiKey) {
    try {
      const geminiClient = new GeminiClient({
        apiKey,
        models: [
          'gemini-3.6-flash',
          'gemini-3.5-flash-lite',
          'gemini-flash-latest',
          env.GEMINI_MODEL,
        ].filter(Boolean) as string[],
      });
      const translator = new CardTranslator(geminiClient);
      return await translator.translate(card);
    } catch (err) {
      geminiError = err instanceof Error ? err.message : String(err);
      console.warn(`[TranslationExecutor] Gemini translation failed, attempting Workers AI fallback: ${geminiError}`);
    }
  }

  // 2. Resilient Fallback: Cloudflare Workers AI (runs on-network, immune to geo-restrictions)
  if (env.AI) {
    try {
      const aiClient = new WorkersAiClient({ ai: env.AI });
      const translator = new CardTranslator(aiClient);
      return await translator.translate(card);
    } catch (aiErr) {
      const aiMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      console.error(`[TranslationExecutor] Workers AI fallback also failed: ${aiMsg}`);
      throw new Error(
        geminiError
          ? `Gemini failed (${geminiError}) and Workers AI failed (${aiMsg})`
          : `Workers AI failed: ${aiMsg}`
      );
    }
  }

  throw new Error(
    geminiError
      ? `Translation failed: ${geminiError}`
      : 'Translation service unavailable: Neither Gemini API Key nor Workers AI binding is available'
  );
}
