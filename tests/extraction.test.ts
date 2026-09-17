import { describe, expect, it } from 'vitest';
import { buildExtractionUserPrompt } from '../src/lib/llm/extraction-prompt';
import { ArticleExtractor } from '../src/lib/llm/extractor';
import { GeminiClient } from '../src/lib/llm/gemini-client';

describe('LLM Extraction', () => {
  it('formats extraction prompt properly', () => {
    const prompt = buildExtractionUserPrompt(
      'DeepSeek v3 671B Released',
      'The model achieves 90% MMLU and runs on 8x H800 GPUs.',
      'reddit'
    );

    expect(prompt).toContain('Source: reddit');
    expect(prompt).toContain('Title: DeepSeek v3 671B Released');
    expect(prompt).toContain('8x H800 GPUs');
  });

  it('parses valid structured JSON correctly', () => {
    const dummyClient = new GeminiClient({ apiKey: 'fake_key' });
    const extractor = new ArticleExtractor(dummyClient);

    const json = JSON.stringify({
      summary: 'DeepSeek v3 sets open weights benchmark record.',
      evidence: ['90% MMLU score', 'FP8 quantized weights available'],
      counter: ['High inference memory required', 'Requires MoE hardware support'],
      context: ['Challenges closed-source frontier models in cost'],
      verification_questions: ['Does it run on single node?', 'What is KV cache size?'],
      entities: [
        { name: 'DeepSeek', type: 'company' },
        { name: 'H800', type: 'technology' },
      ],
      topic_tags: ['AI'],
    });

    const parsed = extractor.parseAndValidate(json, 'Fallback Title');

    expect(parsed.summary).toBe('DeepSeek v3 sets open weights benchmark record.');
    expect(parsed.evidence.length).toBe(2);
    expect(parsed.counter.length).toBe(2);
    expect(parsed.entities.length).toBe(2);
    expect(parsed.entities[0].name).toBe('DeepSeek');
    expect(parsed.entities[0].type).toBe('company');
  });

  it('safely recovers from malformed JSON response', () => {
    const dummyClient = new GeminiClient({ apiKey: 'fake_key' });
    const extractor = new ArticleExtractor(dummyClient);

    const parsed = extractor.parseAndValidate('Not valid JSON {', 'Original Article Title');

    expect(parsed.summary).toBe('Original Article Title');
    expect(parsed.evidence).toEqual([]);
    expect(parsed.counter).toEqual([]);
    expect(parsed.topic_tags).toEqual(['AI']);
  });
});
