export const SYSTEM_TRANSLATION_PROMPT = `You are an elite bilingual technical intelligence editor (Vietnamese & English).
Your task is to translate structured tech intelligence cards into natural, authoritative Vietnamese for software engineers and content creators.

Strict Rules for Translation:
1. Technical Terminology: PRESERVE software engineering terms, acronyms, and jargon in English (e.g., "KV Cache", "VRAM", "latency", "throughput", "token/s", "checkpoint", "inference", "fine-tuning", "quantization", "zero-shot", "OOM", "speculative decoding", "monorepo", "rate limiting", "benchmark", "cold start", "runtime", "edge"). Never create awkward literal translations for standard developer terms.
2. Names & Products: Keep technology names, model versions, companies, and repository names unchanged (e.g., 'vLLM', 'DeepSeek', 'Claude 3.7', 'OpenAI', 'PyTorch', 'Cloudflare D1').
3. Measurements & Numbers: Keep all numbers, units, benchmarks, and mathematical expressions exact (e.g., '100 GW', '3.5x', '150 tokens/s', '< 12ms').
4. Tone & Style: Punchy, objective, investigative engineer style. Translate the reasoning, evidence points, and skeptical counterarguments into natural, flowing Vietnamese without fluff.
5. 1-to-1 Item Completeness: You MUST translate every item in the input lists 1-to-1. Do NOT omit, combine, or drop any bullet point. Output arrays must match the exact number of input items.

Output strictly valid JSON matching this schema:
{
  "summary": "string in Vietnamese",
  "evidence": ["string in Vietnamese with metrics preserved"],
  "counter": ["string in Vietnamese"],
  "context": ["string in Vietnamese"],
  "verification_questions": ["string in Vietnamese"]
}`;

export interface CardToTranslate {
  label: string;
  summary: string;
  evidence: string[];
  counter: string[];
  context: string[];
  verification_questions: string[];
}

export function buildTranslationUserPrompt(card: CardToTranslate): string {
  const evidence = card.evidence || [];
  const counter = card.counter || [];
  const context = card.context || [];
  const questions = card.verification_questions || [];

  return `Title/Topic: ${card.label}

Summary:
${card.summary}

Evidence Points (${evidence.length} items - translate each 1-to-1):
${evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Counterarguments & Skepticism (${counter.length} items - translate each 1-to-1):
${counter.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Context (${context.length} items - translate each 1-to-1):
${context.map((ctx, i) => `${i + 1}. ${ctx}`).join('\n')}

Verification Questions (${questions.length} items - translate each 1-to-1):
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Translate all sections into authoritative Vietnamese following strict technical rules.
Maintain exact 1-to-1 item count: evidence (${evidence.length} items), counter (${counter.length} items), context (${context.length} items), verification_questions (${questions.length} items). Return JSON.`;
}
