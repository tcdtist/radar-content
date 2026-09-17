import { buildExtractionUserPrompt, SYSTEM_EXTRACTION_PROMPT } from './extraction-prompt';
import { GeminiClient } from './gemini-client';
import { StructuredExtraction } from './llm-types';

export class ArticleExtractor {
  private client: GeminiClient;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  async extract(title: string, body: string | null, source: string): Promise<StructuredExtraction> {
    const userPrompt = buildExtractionUserPrompt(title, body, source);
    const jsonString = await this.client.generateJsonContent(SYSTEM_EXTRACTION_PROMPT, userPrompt);
    return this.parseAndValidate(jsonString, title);
  }

  parseAndValidate(jsonString: string, fallbackTitle: string): StructuredExtraction {
    try {
      const parsed = JSON.parse(jsonString) as Partial<StructuredExtraction>;

      return {
        summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary : fallbackTitle,
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence.filter((e) => typeof e === 'string' && e.trim()) : [],
        counter: Array.isArray(parsed.counter) ? parsed.counter.filter((c) => typeof c === 'string' && c.trim()) : [],
        context: Array.isArray(parsed.context) ? parsed.context.filter((c) => typeof c === 'string' && c.trim()) : [],
        verification_questions: Array.isArray(parsed.verification_questions)
          ? parsed.verification_questions.filter((q) => typeof q === 'string' && q.trim())
          : [],
        entities: Array.isArray(parsed.entities)
          ? parsed.entities
              .filter((ent) => ent && typeof ent.name === 'string' && ent.name.trim())
              .map((ent) => ({
                name: ent.name.trim(),
                type: ['technology', 'person', 'company'].includes(ent.type) ? ent.type : 'technology',
              }))
          : [],
        topic_tags: Array.isArray(parsed.topic_tags)
          ? parsed.topic_tags.filter((t) => typeof t === 'string' && t.trim())
          : ['AI'],
      };
    } catch {
      return {
        summary: fallbackTitle,
        evidence: [],
        counter: [],
        context: [],
        verification_questions: [],
        entities: [],
        topic_tags: ['AI'],
      };
    }
  }
}
