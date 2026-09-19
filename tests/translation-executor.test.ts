import { describe, it, expect, vi } from 'vitest';
import { executeCardTranslation } from '../src/workers/translation-executor';
import { WorkerEnv } from '../src/workers/pipeline';

describe('executeCardTranslation', () => {
  const sampleCard = {
    label: 'Test Card',
    summary: 'English summary',
    evidence: ['Evidence 1'],
    counter: ['Counter 1'],
    context: ['Context 1'],
    verification_questions: ['Question 1?'],
  };

  it('falls back to Workers AI when Gemini fails (e.g. location unsupported 400)', async () => {
    // Mock global fetch to simulate Gemini 400 location unsupported
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          error: {
            code: 400,
            message: 'User location is not supported for the API use.',
            status: 'FAILED_PRECONDITION',
          },
        })
      ),
    } as any);

    const mockAi = {
      run: vi.fn().mockResolvedValue({
        response: JSON.stringify({
          summary: 'Tóm tắt tiếng Việt từ Workers AI',
          evidence: ['Bằng chứng 1'],
          counter: ['Phản biện 1'],
          context: ['Bối cảnh 1'],
          verification_questions: ['Câu hỏi 1?'],
        }),
      }),
    };

    const env: WorkerEnv = {
      DB: {} as any,
      GEMINI_API_KEY: 'test-key',
      AI: mockAi,
    };

    try {
      const result = await executeCardTranslation(env, sampleCard);

      expect(mockAi.run).toHaveBeenCalled();
      expect(result.summary).toBe('Tóm tắt tiếng Việt từ Workers AI');
      expect(result.evidence).toEqual(['Bằng chứng 1']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('succeeds with Workers AI directly when no Gemini key is set', async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        response: JSON.stringify({
          summary: 'Dịch trực tiếp qua Workers AI',
          evidence: [],
          counter: [],
          context: [],
          verification_questions: [],
        }),
      }),
    };

    const env: WorkerEnv = {
      DB: {} as any,
      AI: mockAi,
    };

    const result = await executeCardTranslation(env, sampleCard);
    expect(result.summary).toBe('Dịch trực tiếp qua Workers AI');
    expect(mockAi.run).toHaveBeenCalled();
  });
});
