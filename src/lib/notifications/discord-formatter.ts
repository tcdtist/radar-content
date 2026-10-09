import { SourceType } from '../db/types';

export interface ClusterCandidate {
  id: string;
  label: string;
  score: number;
  status: string;
  topic_tags: string;
  article_count: number;
  source_count: number;
}

export interface LinkedArticleExtraction {
  source: SourceType;
  url: string;
  title: string;
  author: string | null;
  summary: string | null;
  evidence: string | null;
  counter: string | null;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
}

/**
 * Format and dispatch Discord Webhook embed for a newly promoted READY cluster.
 */
export async function sendDiscordClusterAlert(
  webhookUrl: string,
  cluster: ClusterCandidate,
  articles: LinkedArticleExtraction[]
): Promise<boolean> {
  const summary = articles.find((a) => a.summary)?.summary || cluster.label;
  const allEvidence = articles.flatMap((a) => parseJsonArray(a.evidence));
  const allCounters = articles.flatMap((a) => parseJsonArray(a.counter));
  const topEvidence = Array.from(new Set(allEvidence)).slice(0, 2);
  const topCounters = Array.from(new Set(allCounters)).slice(0, 2);

  const sourcesList = articles
    .map((a) => (a.author ? `${a.author} (${a.source})` : a.source))
    .slice(0, 3)
    .join(', ');

  const fields = [
    {
      name: '📊 Điểm Tin Cậy & Quy Mô',
      value: `\`Score: ${Math.round(cluster.score)}/100\` • \`${cluster.article_count} bài viết\` • \`${cluster.source_count} nguồn\``,
      inline: false,
    },
  ];

  if (topEvidence.length > 0) {
    fields.push({
      name: '🔍 Bằng Chứng Thực Nghiệm',
      value: topEvidence.map((e) => `• ${e.slice(0, 200)}`).join('\n'),
      inline: false,
    });
  }

  if (topCounters.length > 0) {
    fields.push({
      name: '⚡ Góc Nhìn Phản Biện',
      value: topCounters.map((c) => `• ${c.slice(0, 200)}`).join('\n'),
      inline: false,
    });
  }

  if (sourcesList) {
    fields.push({
      name: '🌐 Nguồn Thảo Luận',
      value: sourcesList,
      inline: false,
    });
  }

  const payload = {
    username: 'Radar Content Bot',
    embeds: [
      {
        title: `🎯 [READY] ${cluster.label}`,
        description: summary.slice(0, 300),
        color: 3066993, // Emerald green (0x2ECC71)
        fields,
        footer: {
          text: 'Radar Content • Cảnh Báo Chủ Đề Chất Lượng Cao (Anti-Spam Filter)',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return res.ok;
}
