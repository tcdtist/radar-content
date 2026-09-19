import { ScoredIntelligenceCard } from '../../lib/db/types';

export interface ExportContent {
  summary: string;
  evidence: string[];
  counter: string[];
  verification_questions: string[];
}

/**
 * Generate formatted Markdown export text for a scored intelligence card.
 */
export function generateCardMarkdown(
  card: ScoredIntelligenceCard,
  displayContent?: Partial<ExportContent>
): string {
  const summary = displayContent?.summary || card.summary;
  const evidence = displayContent?.evidence?.length ? displayContent.evidence : card.evidence;
  const counter = displayContent?.counter?.length ? displayContent.counter : card.counter;
  const questions = displayContent?.verification_questions?.length
    ? displayContent.verification_questions
    : card.verification_questions;

  return `## ${card.label} (Score: ${card.score}/100)
**Status:** ${card.status} | **Topics:** ${card.topic_tags.join(', ')}

### Summary
${summary}

### Key Evidence
${evidence.map((e) => `- ${e}`).join('\n') || '- None recorded'}

### Counterarguments
${counter.map((c) => `- ${c}`).join('\n') || '- None recorded'}

### Verification Checklist
${questions.map((q) => `- [ ] ${q}`).join('\n') || '- None'}

### Sources
${card.sources.map((s) => `- [${s.source.toUpperCase()}] ${s.title}: ${s.url}`).join('\n')}`;
}
