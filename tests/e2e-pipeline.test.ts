import { describe, expect, it } from 'vitest';
import { makeEntityId, SourceType } from '../src/lib/db/types';
import { LeidenAlgorithm } from '../src/lib/graph/leiden-algorithm';
import { ArticleExtractor } from '../src/lib/llm/extractor';
import { GeminiClient } from '../src/lib/llm/gemini-client';
import { ScoringEngine } from '../src/lib/scoring/scoring-engine';

describe('Radar Content E2E Lifecycle Pipeline', () => {
  it('executes full pipeline: normalization -> extraction -> graph -> clustering -> scoring', async () => {
    // 1. Raw Ingestion Simulation
    const rawPostA = {
      source: 'reddit' as SourceType,
      sourceId: 'reddit_test1',
      url: 'https://reddit.com/r/LocalLLaMA/comments/12345/deepseek_v3_benchmarks',
      title: 'DeepSeek-V3 671B Full Benchmark Suite Released',
      body: 'Evaluated on 4x H100 SXM5 GPUs. Achieves 88.5% on HumanEval, rivaling Claude 3.5 Sonnet at 1/10th the inference cost.',
      author: 'ml_researcher',
      publishedAt: Math.floor(Date.now() / 1000) - 1800,
      engagementScore: 420,
      commentsCount: 150,
    };

    const rawPostB = {
      source: 'hn' as SourceType,
      sourceId: 'hn_test2',
      url: 'https://news.ycombinator.com/item?id=987654',
      title: 'DeepSeek-V3 Open Architecture Technical Report',
      body: 'DeepSeek releases architecture details for Multi-head Latent Attention (MLA) and DeepSeekMoE. Benchmark comparison against Llama 3.1 405B.',
      author: 'sama',
      publishedAt: Math.floor(Date.now() / 1000) - 3600,
      engagementScore: 560,
      commentsCount: 210,
    };

    expect(rawPostA.source).toBe('reddit');
    expect(rawPostB.source).toBe('hn');

    // 2. Structured Extraction Simulation
    const dummyClient = new GeminiClient({ apiKey: 'fake_test_key' });
    const extractor = new ArticleExtractor(dummyClient);

    const mockExtractionJsonA = JSON.stringify({
      summary: 'DeepSeek-V3 matches frontier model performance at 10x lower inference cost.',
      evidence: ['88.5% HumanEval pass rate', 'Tested on 4x H100 SXM5 GPUs', '1/10th inference cost of closed models'],
      counter: ['Requires specialized MoE routing kernel', 'High initial VRAM footprint for weights'],
      context: ['Open weights AI rapidly closing the gap with proprietary frontier models'],
      verification_questions: ['Can it run on consumer dual RTX 4090 with quantized weights?', 'What is the exact FP8 memory requirement?'],
      entities: [
        { name: 'DeepSeek', type: 'company' },
        { name: 'H100', type: 'technology' },
        { name: 'MoE', type: 'technology' },
      ],
      topic_tags: ['AI', 'System Design'],
    });

    const extractionA = extractor.parseAndValidate(mockExtractionJsonA, rawPostA.title);
    expect(extractionA.evidence.length).toBe(3);
    expect(extractionA.entities.length).toBe(3);

    // 3. Knowledge Graph Construction
    const nodes = [
      { id: makeEntityId('ent_deepseek'), name: 'deepseek', type: 'company' as const, weight: 2 },
      { id: makeEntityId('ent_h100'), name: 'h100', type: 'technology' as const, weight: 2 },
      { id: makeEntityId('ent_moe'), name: 'moe', type: 'technology' as const, weight: 2 },
      { id: makeEntityId('ent_sqlite'), name: 'sqlite', type: 'technology' as const, weight: 1 },
    ];

    const edges = [
      { source: makeEntityId('ent_deepseek'), target: makeEntityId('ent_h100'), weight: 2.0 },
      { source: makeEntityId('ent_deepseek'), target: makeEntityId('ent_moe'), weight: 2.0 },
      { source: makeEntityId('ent_h100'), target: makeEntityId('ent_moe'), weight: 2.0 },
    ];

    // 4. Leiden Community Detection
    const leiden = new LeidenAlgorithm();
    const communities = leiden.detectCommunities(nodes, edges);

    const commDeepseek = communities.get('ent_deepseek');
    const commH100 = communities.get('ent_h100');
    const commMoe = communities.get('ent_moe');
    const commSqlite = communities.get('ent_sqlite');

    expect(commDeepseek).toBeDefined();
    expect(commDeepseek).toBe(commH100);
    expect(commH100).toBe(commMoe);
    expect(commDeepseek).not.toBe(commSqlite);

    // 5. Composite Scoring & Auto-Promotion
    const scorer = new ScoringEngine();
    const clusterInput = {
      sources: [rawPostA.source, rawPostB.source],
      evidenceCount: extractionA.evidence.length,
      claimCount: 4,
      totalEngagement: rawPostA.engagementScore + rawPostB.engagementScore,
      publishedAtTimestamps: [rawPostA.publishedAt!, rawPostB.publishedAt!],
    };

    const score = scorer.computeScore(clusterInput);
    const status = scorer.determineStatus(clusterInput, 'LEAD');

    expect(score.finalScore).toBeGreaterThanOrEqual(60);
    expect(status).toBe('READY'); // Auto-promoted from LEAD to READY due to 2 sources and >= 2 evidence items
  });
});
