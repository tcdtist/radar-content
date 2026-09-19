import { describe, expect, it, vi } from 'vitest';
import { buildTranslationUserPrompt, SYSTEM_TRANSLATION_PROMPT } from '../src/lib/llm/translation-prompt';
import { CardTranslator } from '../src/lib/llm/translator';
import { GeminiClient } from '../src/lib/llm/gemini-client';

describe('Card Translation Engine', () => {
  const sampleCard = {
    label: 'DeepSeek-V3 · vllm, kv-cache',
    summary: 'DeepSeek releases V3 model with multi-head latent attention.',
    evidence: [
      'Inference throughput reached 150 token/s on 8x H100.',
      'Achieved 4x memory compression with KV Cache quantization.',
    ],
    counter: [
      'Benchmark results show latency spikes during high concurrency.',
    ],
    context: [
      'Competes directly with Claude 3.5 Sonnet and GPT-4o on reasoning benchmarks.',
    ],
    verification_questions: [
      'What was the exact prompt evaluation template used?',
    ],
  };

  it('builds clear translation prompt adhering to technical rules', () => {
    const userPrompt = buildTranslationUserPrompt(sampleCard);
    expect(userPrompt).toContain('DeepSeek-V3');
    expect(userPrompt).toContain('multi-head latent attention');
    expect(userPrompt).toContain('150 token/s');
    expect(SYSTEM_TRANSLATION_PROMPT).toContain('PRESERVE software engineering terms');
  });

  it('preserves all evidence and counter points without truncation on large cards', () => {
    const largeCard = {
      label: 'Google Gemini 3.8',
      summary: 'Large cluster summary',
      evidence: Array.from({ length: 22 }, (_, i) => `Evidence item ${i + 1}`),
      counter: Array.from({ length: 20 }, (_, i) => `Counter item ${i + 1}`),
      context: Array.from({ length: 15 }, (_, i) => `Context item ${i + 1}`),
      verification_questions: Array.from({ length: 24 }, (_, i) => `Question item ${i + 1}`),
    };

    const prompt = buildTranslationUserPrompt(largeCard);
    expect(prompt).toContain('Evidence item 22');
    expect(prompt).toContain('Counter item 20');
    expect(prompt).toContain('Context item 15');
    expect(prompt).toContain('Question item 24');
  });

  it('parses valid JSON translation accurately', () => {
    const translator = new CardTranslator({} as GeminiClient);
    const mockJson = JSON.stringify({
      summary: 'DeepSeek ra mắt mô hình V3 với multi-head latent attention.',
      evidence: [
        'Throughput inference đạt 150 token/s trên 8x H100.',
        'Đạt tỷ lệ nén bộ nhớ 4x với KV Cache quantization.',
      ],
      counter: [
        'Kết quả benchmark cho thấy độ trễ tăng đột biến khi concurrency cao.',
      ],
      context: [
        'Cạnh tranh trực tiếp với Claude 3.5 Sonnet và GPT-4o.',
      ],
      verification_questions: [
        'Template prompt evaluation chính xác được sử dụng là gì?',
      ],
    });

    const parsed = translator.parseAndValidate(mockJson, sampleCard);
    expect(parsed.summary).toContain('DeepSeek ra mắt mô hình V3');
    expect(parsed.evidence[0]).toContain('150 token/s');
    expect(parsed.counter[0]).toContain('benchmark');
    expect(parsed.context[0]).toContain('Claude 3.5 Sonnet');
    expect(parsed.verification_questions[0]).toContain('prompt evaluation');
  });

  it('handles markdown fences in LLM output', () => {
    const translator = new CardTranslator({} as GeminiClient);
    const mockFencedJson = `\`\`\`json
{
  "summary": "Bản dịch tóm tắt tiếng Việt.",
  "evidence": ["Bằng chứng 1"],
  "counter": ["Phản biện 1"],
  "context": ["Ngữ cảnh 1"],
  "verification_questions": ["Câu hỏi kiểm tra 1"]
}
\`\`\``;

    const parsed = translator.parseAndValidate(mockFencedJson, sampleCard);
    expect(parsed.summary).toBe('Bản dịch tóm tắt tiếng Việt.');
    expect(parsed.evidence).toEqual(['Bằng chứng 1']);
  });

  it('falls back safely to original content on malformed JSON', () => {
    const translator = new CardTranslator({} as GeminiClient);
    const parsed = translator.parseAndValidate('not a valid json output', sampleCard);

    expect(parsed.summary).toBe(sampleCard.summary);
    expect(parsed.evidence).toEqual(sampleCard.evidence);
    expect(parsed.counter).toEqual(sampleCard.counter);
  });

  it('translates card using GeminiClient generateJsonContent', async () => {
    const mockClient = {
      generateJsonContent: vi.fn().mockResolvedValue(
        JSON.stringify({
          summary: 'Tóm tắt tiếng Việt thành công.',
          evidence: ['Bằng chứng tiếng Việt.'],
          counter: ['Phản biện tiếng Việt.'],
          context: ['Bối cảnh.'],
          verification_questions: ['Kiểm tra nguồn.'],
        })
      ),
    } as unknown as GeminiClient;

    const translator = new CardTranslator(mockClient);
    const result = await translator.translate(sampleCard);

    expect(mockClient.generateJsonContent).toHaveBeenCalledOnce();
    expect(result.summary).toBe('Tóm tắt tiếng Việt thành công.');
    expect(result.evidence).toEqual(['Bằng chứng tiếng Việt.']);
  });
});
