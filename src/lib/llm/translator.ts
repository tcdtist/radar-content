import { buildTranslationUserPrompt, CardToTranslate, SYSTEM_TRANSLATION_PROMPT } from './translation-prompt';

export interface TranslatedCardContent {
  summary: string;
  evidence: string[];
  counter: string[];
  context: string[];
  verification_questions: string[];
}

export interface ILlmClient {
  generateJsonContent(systemPrompt: string, userPrompt: string): Promise<string>;
}

export function cleanJsonString(raw: string): string {
  let str = raw.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
  const firstOpen = str.indexOf('{');
  const lastClose = str.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1) {
    str = str.slice(firstOpen, lastClose + 1);
  }
  return str.replace(/,\s*([}\]])/g, '$1');
}

export class CardTranslator {
  private client: ILlmClient;

  constructor(client: ILlmClient) {
    this.client = client;
  }

  async translate(card: CardToTranslate): Promise<TranslatedCardContent> {
    const userPrompt = buildTranslationUserPrompt(card);
    const rawJson = await this.client.generateJsonContent(SYSTEM_TRANSLATION_PROMPT, userPrompt);
    return this.parseAndValidate(rawJson, card);
  }

  parseAndValidate(jsonString: string, fallback: CardToTranslate): TranslatedCardContent {
    try {
      const cleaned = cleanJsonString(jsonString);
      if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) {
        throw new Error(`Invalid JSON format from LLM: ${jsonString.slice(0, 100)}`);
      }

      const parsed = JSON.parse(cleaned) as Partial<TranslatedCardContent>;
      const summary =
        typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : fallback.summary;

      return {
        summary,
        evidence: Array.isArray(parsed.evidence) && parsed.evidence.length > 0
          ? parsed.evidence.filter((e) => typeof e === 'string' && e.trim())
          : fallback.evidence,
        counter: Array.isArray(parsed.counter) && parsed.counter.length > 0
          ? parsed.counter.filter((c) => typeof c === 'string' && c.trim())
          : fallback.counter,
        context: Array.isArray(parsed.context) && parsed.context.length > 0
          ? parsed.context.filter((ctx) => typeof ctx === 'string' && ctx.trim())
          : fallback.context,
        verification_questions: Array.isArray(parsed.verification_questions) && parsed.verification_questions.length > 0
          ? parsed.verification_questions.filter((q) => typeof q === 'string' && q.trim())
          : fallback.verification_questions,
      };
    } catch (err) {
      console.warn('[CardTranslator] JSON parse fallback triggered:', err);
      return {
        summary: fallback.summary,
        evidence: fallback.evidence,
        counter: fallback.counter,
        context: fallback.context,
        verification_questions: fallback.verification_questions,
      };
    }
  }
}
