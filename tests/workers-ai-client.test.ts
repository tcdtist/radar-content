import { describe, it, expect, vi } from 'vitest';
import { WorkersAiClient } from '../src/lib/llm/workers-ai-client';

describe('WorkersAiClient', () => {
  it('successfully generates content from primary model', async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        response: JSON.stringify({ summary: 'Bản dịch tóm tắt' }),
      }),
    };

    const client = new WorkersAiClient({ ai: mockAi });
    const result = await client.generateJsonContent('system prompt', 'user prompt');

    expect(mockAi.run).toHaveBeenCalledTimes(1);
    expect(mockAi.run).toHaveBeenCalledWith('@cf/meta/llama-3.1-8b-instruct-fp8', expect.any(Object));
    expect(result).toBe('{"summary":"Bản dịch tóm tắt"}');
  });

  it('rotates to secondary model if primary model throws', async () => {
    const mockAi = {
      run: vi
        .fn()
        .mockRejectedValueOnce(new Error('GPU capacity exceeded'))
        .mockResolvedValueOnce({
          response: '{"summary":"Bản dịch từ model 2"}',
        }),
    };

    const client = new WorkersAiClient({ ai: mockAi });
    const result = await client.generateJsonContent('system prompt', 'user prompt');

    expect(mockAi.run).toHaveBeenCalledTimes(2);
    expect(result).toBe('{"summary":"Bản dịch từ model 2"}');
  });

  it('handles raw string response format', async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue('{"summary":"Chuỗi JSON trực tiếp"}'),
    };

    const client = new WorkersAiClient({ ai: mockAi });
    const result = await client.generateJsonContent('system', 'user');

    expect(result).toBe('{"summary":"Chuỗi JSON trực tiếp"}');
  });

  it('throws descriptive error if all models fail', async () => {
    const mockAi = {
      run: vi.fn().mockRejectedValue(new Error('Service Unavailable')),
    };

    const client = new WorkersAiClient({ ai: mockAi });
    await expect(client.generateJsonContent('sys', 'user')).rejects.toThrow('Service Unavailable');
  });
});
