import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiClient, DEFAULT_TIERED_MODELS } from '../src/lib/llm/gemini-client';

describe('GeminiClient Tiered Cascade and Model Rotation', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initializes with default top-down quality cascade starting from gemini-3.8-flash', () => {
    const client = new GeminiClient({ apiKey: 'fake_key' });
    const models = client.getActiveModels();

    expect(models[0]).toBe('gemini-3.8-flash');
    expect(models[1]).toBe('gemini-3.7-flash');
    expect(models[2]).toBe('gemini-3.6-flash');
    expect(models).toEqual([...DEFAULT_TIERED_MODELS]);
  });

  it('prioritizes explicitly passed preferred model ahead of tiered defaults', () => {
    const client = new GeminiClient({ apiKey: 'fake_key', model: 'custom-experimental-model' });
    const models = client.getActiveModels();

    expect(models[0]).toBe('custom-experimental-model');
    expect(models[1]).toBe('gemini-3.8-flash');
    expect(models).toContain('gemini-3.7-flash');
  });

  it('rotates gracefully to next tier when top model hits HTTP 429 quota exhaustion', async () => {
    const calledModels: string[] = [];

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const match = url.match(/models\/([^:]+):generateContent/);
      const modelName = match ? decodeURIComponent(match[1]) : 'unknown';
      calledModels.push(modelName);

      if (modelName === 'gemini-3.8-flash') {
        return new Response(JSON.stringify({ error: { message: 'Quota exceeded' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ summary: 'Success with 3.7' }) }],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    const client = new GeminiClient({
      apiKey: 'test_key',
      models: ['gemini-3.8-flash', 'gemini-3.7-flash'],
      maxRetries: 1,
    });

    const result = await client.generateJsonContent('system', 'user');

    expect(result).toBe(JSON.stringify({ summary: 'Success with 3.7' }));
    expect(calledModels).toContain('gemini-3.8-flash');
    expect(calledModels).toContain('gemini-3.7-flash');
  });

  it('rotates immediately without retrying on HTTP 404', async () => {
    const calledModels: string[] = [];

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const match = url.match(/models\/([^:]+):generateContent/);
      const modelName = match ? decodeURIComponent(match[1]) : 'unknown';
      calledModels.push(modelName);

      if (modelName === 'gemini-3.8-flash') {
        return new Response(JSON.stringify({ error: { message: 'Not found' } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ summary: 'Found on fallback' }) }],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    const client = new GeminiClient({
      apiKey: 'test_key',
      models: ['gemini-3.8-flash', 'gemini-3.7-flash'],
      maxRetries: 2,
    });

    const result = await client.generateJsonContent('system', 'user');

    expect(result).toBe(JSON.stringify({ summary: 'Found on fallback' }));
    expect(calledModels.filter((m) => m === 'gemini-3.8-flash').length).toBe(1);
    expect(calledModels).toContain('gemini-3.7-flash');
  });

  it('aborts immediately without rotating models on fatal geo-blocking error', async () => {
    const calledModels: string[] = [];

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const match = url.match(/models\/([^:]+):generateContent/);
      const modelName = match ? decodeURIComponent(match[1]) : 'unknown';
      calledModels.push(modelName);

      return new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: 'User location is not supported for the API use.',
            status: 'FAILED_PRECONDITION',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    const client = new GeminiClient({
      apiKey: 'test_key',
      models: ['gemini-3.6-flash', 'gemini-3.5-flash-lite'],
      maxRetries: 2,
    });

    await expect(client.generateJsonContent('system', 'user')).rejects.toThrow(
      /Gemini fatal geo-block error HTTP 400/
    );
    // Must only have called the first model once, with ZERO retries and ZERO model rotations
    expect(calledModels.length).toBe(1);
    expect(calledModels[0]).toBe('gemini-3.6-flash');
  });

  it('aborts immediately on fatal auth error (401/403)', async () => {
    const calledModels: string[] = [];

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const match = url.match(/models\/([^:]+):generateContent/);
      const modelName = match ? decodeURIComponent(match[1]) : 'unknown';
      calledModels.push(modelName);

      return new Response(JSON.stringify({ error: { message: 'API key not valid' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new GeminiClient({
      apiKey: 'bad_key',
      models: ['gemini-3.6-flash', 'gemini-3.5-flash-lite'],
      maxRetries: 2,
    });

    await expect(client.generateJsonContent('system', 'user')).rejects.toThrow(
      /Gemini fatal auth error HTTP 403/
    );
    expect(calledModels.length).toBe(1);
  });
});
