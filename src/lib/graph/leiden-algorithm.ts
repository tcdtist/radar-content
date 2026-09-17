import { GraphEdge, GraphNode } from './entity-types';

export interface CommunityResult {
  nodeId: string;
  communityId: number;
}

export interface LeidenGraph {
  nodes: string[];
  edges: Array<{ source: string; target: string; weight: number }>;
}

/**
 * Deterministic, edge-safe Leiden Community Detection for weighted undirected graphs.
 */
export class LeidenAlgorithm {
  private resolution: number;

  constructor(resolution = 1.0) {
    this.resolution = resolution;
  }

  detectCommunities(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
    if (nodes.length === 0) {
      return new Map();
    }

    const nodeIds = nodes.map((n) => n.id);
    const nodeIndex = new Map<string, number>();
    nodeIds.forEach((id, idx) => nodeIndex.set(id, idx));

    const n = nodeIds.length;
    // Build adjacency matrix / list
    const adj: Array<Map<number, number>> = Array.from({ length: n }, () => new Map());
    let totalWeight = 0;

    for (const edge of edges) {
      const u = nodeIndex.get(edge.source);
      const v = nodeIndex.get(edge.target);
      if (u !== undefined && v !== undefined && u !== v) {
        const currentW = adj[u].get(v) || 0;
        const newW = currentW + edge.weight;
        adj[u].set(v, newW);
        adj[v].set(u, newW);
        totalWeight += edge.weight;
      }
    }

    if (totalWeight === 0) {
      const result = new Map<string, number>();
      nodeIds.forEach((id, idx) => result.set(id, idx));
      return result;
    }

    // Node degrees (weighted sum)
    const degrees = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (const w of adj[i].values()) {
        sum += w;
      }
      degrees[i] = sum;
    }

    // Initial partition: each node in its own community
    const communities = new Int32Array(n);
    const commTotalDegrees = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      communities[i] = i;
      commTotalDegrees.set(i, degrees[i]);
    }

    const m2 = totalWeight * 2;
    let improved = true;
    let iteration = 0;
    const maxIterations = 20;

    // Fast local moving phase
    while (improved && iteration < maxIterations) {
      improved = false;
      iteration++;

      for (let i = 0; i < n; i++) {
        const currentComm = communities[i];
        const neighbors = adj[i];
        if (neighbors.size === 0) continue;

        const k_i = degrees[i];
        // Weight from node i to its current community (excluding self loops)
        let weightToCurrent = 0;

        // Sum weights to each neighboring community
        const commWeights = new Map<number, number>();
        for (const [neighbor, weight] of neighbors.entries()) {
          const c = communities[neighbor];
          if (c === currentComm) {
            weightToCurrent += weight;
          } else {
            commWeights.set(c, (commWeights.get(c) || 0) + weight);
          }
        }

        let bestComm = currentComm;
        let maxDeltaQ = 0;

        const currentTot = (commTotalDegrees.get(currentComm) || 0) - k_i;

        for (const [targetComm, weightToTarget] of commWeights.entries()) {
          const targetTot = commTotalDegrees.get(targetComm) || 0;
          const deltaQ = (weightToTarget - weightToCurrent) - (this.resolution * k_i * (targetTot - currentTot)) / m2;

          if (deltaQ > maxDeltaQ) {
            maxDeltaQ = deltaQ;
            bestComm = targetComm;
          }
        }

        if (bestComm !== currentComm && maxDeltaQ > 1e-5) {
          commTotalDegrees.set(currentComm, (commTotalDegrees.get(currentComm) || 0) - k_i);
          commTotalDegrees.set(bestComm, (commTotalDegrees.get(bestComm) || 0) + k_i);
          communities[i] = bestComm;
          improved = true;
        }
      }
    }

    // Map communities to compact 0-indexed IDs
    const commMapping = new Map<number, number>();
    let nextCommId = 0;
    const resultMap = new Map<string, number>();

    for (let i = 0; i < n; i++) {
      const rawComm = communities[i];
      let mapped = commMapping.get(rawComm);
      if (mapped === undefined) {
        mapped = nextCommId++;
        commMapping.set(rawComm, mapped);
      }
      resultMap.set(nodeIds[i], mapped);
    }

    return resultMap;
  }
}
