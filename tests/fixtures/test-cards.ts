import { makeClusterId, ScoredIntelligenceCard } from '../../src/lib/db/types';

export const TEST_CARDS: ScoredIntelligenceCard[] = [
  {
    id: makeClusterId('clust_test_1'),
    label: 'DeepSeek-V3 MoE Architecture: Multi-Head Latent Attention in Production',
    topic_tags: ['AI', 'System Design'],
    score: 94,
    status: 'READY',
    article_count: 14,
    source_count: 2,
    created_at: 1789500000,
    updated_at: 1789510000,
    summary:
      'DeepSeek-V3 implements Multi-Head Latent Attention (MLA) and DeepSeekMoE architectures, delivering state-of-the-art reasoning while cutting inference memory footprint by over 60%.',
    evidence: [
      'MLA compresses KV cache into low-dimensional latent vectors, reducing memory by 5.3x during inference.',
      'Fine-grained expert segmentation with 256 routed experts and 1 shared expert achieves higher specialization without comms overhead.',
    ],
    counter: [
      'DualPipe communication schedule introduces implementation complexity on heterogeneous clusters.',
    ],
    context: [
      'Surging developer interest in local deployment via Ollama and llama.cpp.',
    ],
    verification_questions: [
      'Has the FP8 quantized checkpoint verified parity against official BF16 benchmarks on GSM8K?',
    ],
    entities: [
      { name: 'DeepSeek', type: 'company' },
      { name: 'Multi-Head Latent Attention', type: 'technology' },
    ],
    sources: [
      {
        title: 'DeepSeek-V3 Technical Report & Architecture Teardown',
        url: 'https://news.ycombinator.com/item?id=42500001',
        source: 'hn',
        author: 'greg_brock',
        published_at: 1789490000,
      },
    ],
  },
  {
    id: makeClusterId('clust_test_2'),
    label: 'SQLite Vector Extensions vs pgvector: Edge RAG Trade-offs',
    topic_tags: ['Database', 'Backend'],
    score: 87,
    status: 'READY',
    article_count: 9,
    source_count: 2,
    created_at: 1789480000,
    updated_at: 1789505000,
    summary:
      'sqlite-vec brings zero-dependency vector similarity search directly into embedded and serverless environments, challenging heavier client-server setups.',
    evidence: [
      'Native SIMD vector operations written in pure C with zero runtime dependencies beyond SQLite.',
      'Sub-millisecond cosine distance lookups for collections under 100,000 vectors on Cloudflare D1/Workers.',
    ],
    counter: [
      'Lacks HNSW index persistence; exact KNN scan limits scale to approximately 250,000 vectors.',
    ],
    context: [
      'Discussions highlight adoption in local desktop AI assistants.',
    ],
    verification_questions: [
      'Does sqlite-vec work in WASM environments inside browser ServiceWorkers?',
    ],
    entities: [
      { name: 'sqlite-vec', type: 'technology' },
      { name: 'pgvector', type: 'technology' },
    ],
    sources: [
      {
        title: 'sqlite-vec v0.1.3: Fast vector search everywhere SQLite runs',
        url: 'https://news.ycombinator.com/item?id=42500002',
        source: 'hn',
        author: 'asg017',
        published_at: 1789470000,
      },
    ],
  },
];
