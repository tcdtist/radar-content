import { CardStatus, CardTranslation, ScoredIntelligenceCard } from '../../lib/db/types';
import { getAuthToken, isAdmin } from './auth';

export interface DashboardStats {
  totalArticles: number;
  totalClusters: number;
  readyCount: number;
  writtenCount: number;
}

const API_BASE =
  import.meta.env.VITE_API_URL ||
  '/api';

const DEFAULT_TIMEOUT_MS = 30000;

function withTimeout(ms = DEFAULT_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const EMPTY_STATS: DashboardStats = {
  totalArticles: 0,
  totalClusters: 0,
  readyCount: 0,
  writtenCount: 0,
};

export async function fetchStats(): Promise<DashboardStats> {
  if (!isAdmin()) {
    return EMPTY_STATS;
  }

  try {
    const res = await fetch(`${API_BASE}/stats`, {
      headers: getAuthHeaders(),
      signal: withTimeout(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { success: boolean; stats: DashboardStats };
    return data.success && data.stats ? data.stats : EMPTY_STATS;
  } catch (err) {
    console.warn('[Radar Client] Failed to fetch live stats:', err);
    return EMPTY_STATS;
  }
}

export async function fetchCards(filters: {
  topic?: string;
  status?: string;
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<ScoredIntelligenceCard[]> {
  try {
    const params = new URLSearchParams();
    if (filters.topic && filters.topic !== 'all') params.set('topic', filters.topic);
    if (filters.status) params.set('status', filters.status);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));

    const res = await fetch(`${API_BASE}/cards?${params.toString()}`, {
      headers: getAuthHeaders(),
      signal: withTimeout(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { success: boolean; cards: ScoredIntelligenceCard[] };
    return data.success && Array.isArray(data.cards) ? data.cards : [];
  } catch (err) {
    console.warn('[Radar Client] Failed to fetch live cards:', err);
    return [];
  }
}

export async function fetchCardById(id: string): Promise<ScoredIntelligenceCard | null> {
  try {
    const res = await fetch(`${API_BASE}/cards/${encodeURIComponent(id)}`, {
      headers: getAuthHeaders(),
      signal: withTimeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { success: boolean; card?: ScoredIntelligenceCard };
    return data.success && data.card ? data.card : null;
  } catch (err) {
    console.warn(`[Radar Client] Failed to fetch card ${id}:`, err);
    return null;
  }
}

export async function updateCardAction(id: string, action: CardStatus): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/cards/${id}/action`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action }),
      signal: withTimeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { success: boolean };
    return Boolean(data.success);
  } catch (err) {
    console.warn('[Radar Client] Failed to post card action:', err);
    return false;
  }
}

export async function triggerCrawl(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/crawl/trigger`, {
      method: 'POST',
      headers: getAuthHeaders(),
      signal: withTimeout(8000),
    });
    const data = (await res.json()) as { success: boolean };
    return Boolean(data.success);
  } catch (err) {
    console.warn('[Radar Client] Crawler trigger error:', err);
    return false;
  }
}

export async function triggerProcess(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/process/trigger`, {
      method: 'POST',
      headers: getAuthHeaders(),
      signal: withTimeout(8000),
    });
    const data = (await res.json()) as { success: boolean };
    return Boolean(data.success);
  } catch (err) {
    console.warn('[Radar Client] Process trigger error:', err);
    return false;
  }
}

export async function translateCard(
  id: string,
  card?: Partial<ScoredIntelligenceCard>
): Promise<CardTranslation | null> {
  try {
    const res = await fetch(`${API_BASE}/cards/${encodeURIComponent(id)}/translate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ card }),
      signal: withTimeout(45000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { success: boolean; translation: CardTranslation };
    return data.success && data.translation ? data.translation : null;
  } catch (err) {
    console.warn('[Radar Client] Failed to translate card:', err);
    return null;
  }
}


