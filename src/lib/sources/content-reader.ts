/**
 * Content reader module using Jina Reader API (https://r.jina.ai/)
 * Converts any web article into clean, LLM-ready Markdown.
 */

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_CONTENT_LENGTH = 8000; // ~1800-2000 tokens, safely within free Gemini quotas

export interface ContentReaderOptions {
  timeoutMs?: number;
  maxCharacters?: number;
  jinaBaseUrl?: string;
}

/**
 * Fetch and extract clean markdown content from an external web URL.
 */
export async function fetchArticleContent(
  url: string,
  options: ContentReaderOptions = {}
): Promise<string | null> {
  if (!url || !url.startsWith('http')) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.16.') ||
      host.startsWith('169.254.') ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return null;
    }
  } catch {
    return null;
  }

  // Avoid running reader on discussion aggregator index URLs
  if (url.includes('news.ycombinator.com') || url.includes('lobste.rs/s/')) {
    return null;
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxCharacters = options.maxCharacters ?? MAX_CONTENT_LENGTH;
  const jinaBaseUrl = options.jinaBaseUrl ?? 'https://r.jina.ai';

  try {
    const targetUrl = `${jinaBaseUrl}/${url}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/plain',
        'X-Timeout': Math.floor(timeoutMs / 1000).toString(),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const text = await response.text();

    // Guard against Jina error output pages
    if (
      !text ||
      text.length < 50 ||
      text.includes('Target URL returned error') ||
      text.includes('403: Forbidden') ||
      text.includes('404: Not Found')
    ) {
      return null;
    }

    // Clean and trim content
    const cleaned = text.trim();
    if (cleaned.length <= maxCharacters) {
      return cleaned;
    }

    // Truncate cleanly at a reasonable boundary
    const sliced = cleaned.slice(0, maxCharacters);
    const lastNewline = sliced.lastIndexOf('\n');
    return (lastNewline > maxCharacters * 0.8 ? sliced.slice(0, lastNewline) : sliced) + '\n\n[...content truncated for token budget...]';
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('aborted')) {
      console.warn(`[ContentReader] Timeout fetching URL: ${url}`);
    } else {
      console.error(`[ContentReader] Error fetching URL ${url}:`, message);
    }
    return null;
  }
}
