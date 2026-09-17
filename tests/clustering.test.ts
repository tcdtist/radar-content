import { describe, expect, it } from 'vitest';
import { makeEntityId } from '../src/lib/db/types';
import { GraphEdge, GraphNode } from '../src/lib/graph/entity-types';
import { LeidenAlgorithm } from '../src/lib/graph/leiden-algorithm';

describe('LeidenAlgorithm', () => {
  it('handles empty nodes gracefully', () => {
    const leiden = new LeidenAlgorithm();
    const result = leiden.detectCommunities([], []);
    expect(result.size).toBe(0);
  });

  it('clusters two separate cliques into distinct communities', () => {
    const leiden = new LeidenAlgorithm(1.0);

    // Clique 1: LLM models
    const nodeA: GraphNode = { id: makeEntityId('deepseek'), name: 'deepseek', type: 'technology', weight: 3 };
    const nodeB: GraphNode = { id: makeEntityId('llama'), name: 'llama', type: 'technology', weight: 3 };
    const nodeC: GraphNode = { id: makeEntityId('qwen'), name: 'qwen', type: 'technology', weight: 3 };

    // Clique 2: Databases
    const nodeD: GraphNode = { id: makeEntityId('sqlite'), name: 'sqlite', type: 'technology', weight: 3 };
    const nodeE: GraphNode = { id: makeEntityId('postgres'), name: 'postgres', type: 'technology', weight: 3 };
    const nodeF: GraphNode = { id: makeEntityId('d1'), name: 'd1', type: 'technology', weight: 3 };

    const nodes = [nodeA, nodeB, nodeC, nodeD, nodeE, nodeF];

    const edges: GraphEdge[] = [
      // Within Clique 1 (strong weights)
      { source: nodeA.id, target: nodeB.id, weight: 5.0 },
      { source: nodeB.id, target: nodeC.id, weight: 5.0 },
      { source: nodeA.id, target: nodeC.id, weight: 5.0 },

      // Within Clique 2 (strong weights)
      { source: nodeD.id, target: nodeE.id, weight: 5.0 },
      { source: nodeE.id, target: nodeF.id, weight: 5.0 },
      { source: nodeD.id, target: nodeF.id, weight: 5.0 },

      // Weak bridge between cliques
      { source: nodeA.id, target: nodeD.id, weight: 0.1 },
    ];

    const communities = leiden.detectCommunities(nodes, edges);

    const commA = communities.get(nodeA.id);
    const commB = communities.get(nodeB.id);
    const commC = communities.get(nodeC.id);

    const commD = communities.get(nodeD.id);
    const commE = communities.get(nodeE.id);
    const commF = communities.get(nodeF.id);

    // Nodes in Clique 1 should share the same community
    expect(commA).toBeDefined();
    expect(commA).toBe(commB);
    expect(commB).toBe(commC);

    // Nodes in Clique 2 should share the same community
    expect(commD).toBeDefined();
    expect(commD).toBe(commE);
    expect(commE).toBe(commF);

    // Clique 1 community must differ from Clique 2 community
    expect(commA).not.toBe(commD);
  });
});
