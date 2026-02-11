import type { RunResult } from '@/lib/api/review';
import type { ReviewMode, WeakKnowledgeCandidate } from '@/server/review/review-engine';

const readPositiveInt = (raw: string | undefined, fallback: number) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const PROFILE_API_BASE =
  process.env.MONGODB_PROFILE_API_BASE?.trim() ||
  process.env.PROFILE_API_BASE_URL?.trim() ||
  'http://127.0.0.1:5000';

const PROFILE_FETCH_TIMEOUT_MS = readPositiveInt(process.env.PROFILE_SYNC_TIMEOUT_MS, 5_000);
const IDEMPOTENT_TTL_MS = 24 * 60 * 60 * 1000;

const seenRoundWrites = new Map<string, number>();

interface WeakKnowledgePoint {
  knowledge_id: string;
  knowledge_name: string;
  knowledge_category: string[];
  weak_reason: string;
  weak_score: number;
  first_weak_time: string;
  last_review_time: string | null;
  review_count: number;
}

interface SyncWeakKnowledgeInput {
  userId: string;
  mode: ReviewMode;
  roundId?: string;
  reviewSummary: string;
  runResult?: RunResult;
  candidates: WeakKnowledgeCandidate[];
}

export interface SyncWeakKnowledgeResult {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

class ProfileSyncError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProfileSyncError';
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const unique = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const clampScore = (score: number) => Math.max(0, Math.min(10, Math.round(score)));

const cleanupSeenRoundWrites = () => {
  const now = Date.now();
  for (const [key, timestamp] of seenRoundWrites.entries()) {
    if (now - timestamp > IDEMPOTENT_TTL_MS) {
      seenRoundWrites.delete(key);
    }
  }
  if (seenRoundWrites.size > 4_000) {
    const entries = Array.from(seenRoundWrites.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3_000);
    seenRoundWrites.clear();
    for (const [key, timestamp] of entries) {
      seenRoundWrites.set(key, timestamp);
    }
  }
};

const isSeenInRound = (key: string) => {
  cleanupSeenRoundWrites();
  return seenRoundWrites.has(key);
};

const markSeenInRound = (key: string) => {
  cleanupSeenRoundWrites();
  seenRoundWrites.set(key, Date.now());
};

const toDateTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
};

const mergeReason = (oldReason: string, newReason: string) => {
  const merged = unique(
    [...oldReason.split(/[；;]/), ...newReason.split(/[；;]/)].map((reason) => reason.trim()).filter(Boolean)
  ).join('；');
  return merged.slice(0, 280);
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = PROFILE_FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const normalizeWeakPoint = (value: unknown): WeakKnowledgePoint | null => {
  if (!isRecord(value)) return null;
  const knowledgeId = typeof value.knowledge_id === 'string' ? value.knowledge_id : '';
  if (!knowledgeId) return null;
  return {
    knowledge_id: knowledgeId,
    knowledge_name: typeof value.knowledge_name === 'string' ? value.knowledge_name : knowledgeId,
    knowledge_category: Array.isArray(value.knowledge_category)
      ? value.knowledge_category.map((item) => String(item))
      : [],
    weak_reason: typeof value.weak_reason === 'string' ? value.weak_reason : '',
    weak_score: clampScore(asNumber(value.weak_score, 0)),
    first_weak_time: typeof value.first_weak_time === 'string' ? value.first_weak_time : '',
    last_review_time: typeof value.last_review_time === 'string' ? value.last_review_time : null,
    review_count: Math.max(0, Math.round(asNumber(value.review_count, 0))),
  };
};

const getExistingWeakKnowledge = async (userId: string): Promise<WeakKnowledgePoint[]> => {
  const url = `${PROFILE_API_BASE.replace(/\/+$/, '')}/api/mongodb/user_profile/${encodeURIComponent(userId)}`;
  const response = await fetchWithTimeout(url, { method: 'GET' });
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ProfileSyncError(
      `GET user profile failed: ${response.status} ${body.slice(0, 180)}`.trim(),
      response.status
    );
  }

  const data = (await response.json().catch(() => ({}))) as unknown;
  const container = isRecord(data) && isRecord(data.user_profile) ? data.user_profile : data;
  if (!isRecord(container) || !Array.isArray(container.weak_knowledge)) {
    return [];
  }

  return container.weak_knowledge
    .map((item) => normalizeWeakPoint(item))
    .filter((item): item is WeakKnowledgePoint => Boolean(item));
};

const requestWithFallback = async (method: 'POST' | 'PUT', url: string, payloads: unknown[]) => {
  let latestStatus: number | undefined;
  const logs: string[] = [];

  for (const payload of payloads) {
    try {
      const response = await fetchWithTimeout(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return;
      }

      latestStatus = response.status;
      const body = await response.text().catch(() => '');
      logs.push(`${response.status}:${body.slice(0, 180)}`);
    } catch (error) {
      logs.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new ProfileSyncError(
    `${method} request failed for ${url}. ${logs.filter(Boolean).join(' | ')}`.trim(),
    latestStatus
  );
};

const appendWeakKnowledge = async (
  userId: string,
  weakPoint: WeakKnowledgePoint,
  metadata: { mode: ReviewMode; roundId?: string; reviewSummary: string; runResult?: RunResult }
) => {
  const url = `${PROFILE_API_BASE.replace(/\/+$/, '')}/api/mongodb/user_profile`;
  const profilePayload = {
    user_id: userId,
    weak_knowledge: [weakPoint],
    source: 'review',
    mode: metadata.mode,
    round_id: metadata.roundId ?? null,
    review_summary: metadata.reviewSummary,
    run_success: metadata.runResult?.success ?? null,
  };
  const payload = {
    user_id: userId,
    profile_json_str: JSON.stringify(profilePayload),
  };
  await requestWithFallback('POST', url, [payload]);
};

const updateWeakKnowledge = async (
  userId: string,
  weakPoint: WeakKnowledgePoint,
  metadata: { mode: ReviewMode; roundId?: string; reviewSummary: string; runResult?: RunResult }
) => {
  const url = `${PROFILE_API_BASE.replace(/\/+$/, '')}/api/mongodb/user_profile/${encodeURIComponent(
    userId
  )}/weak/${encodeURIComponent(weakPoint.knowledge_id)}`;
  const reviewRecord = {
    source: 'review',
    mode: metadata.mode,
    round_id: metadata.roundId ?? null,
    review_summary: metadata.reviewSummary,
    run_success: metadata.runResult?.success ?? null,
    error_type: metadata.runResult?.errorType ?? null,
  };
  const payload = {
    profile_update_str: JSON.stringify({
      weak_score: weakPoint.weak_score,
      weak_reason: weakPoint.weak_reason,
      review_record: reviewRecord,
    }),
  };
  await requestWithFallback('PUT', url, [payload]);
};

const normalizeCandidate = (candidate: WeakKnowledgeCandidate, now: string): WeakKnowledgePoint => ({
  knowledge_id: candidate.knowledge_id,
  knowledge_name: candidate.knowledge_name || candidate.knowledge_id,
  knowledge_category: unique(candidate.knowledge_category),
  weak_reason: candidate.weak_reason.trim().slice(0, 280),
  weak_score: clampScore(candidate.weak_score),
  first_weak_time: now,
  last_review_time: null,
  review_count: 0,
});

const mergeWithExisting = (existing: WeakKnowledgePoint, incoming: WeakKnowledgePoint, now: string): WeakKnowledgePoint => ({
  knowledge_id: existing.knowledge_id,
  knowledge_name: existing.knowledge_name || incoming.knowledge_name,
  knowledge_category: unique([...existing.knowledge_category, ...incoming.knowledge_category]),
  weak_reason: mergeReason(existing.weak_reason, incoming.weak_reason),
  weak_score: Math.max(clampScore(existing.weak_score), clampScore(incoming.weak_score)),
  first_weak_time: existing.first_weak_time || now,
  last_review_time: null,
  review_count: Math.max(0, asNumber(existing.review_count, 0)),
});

export const syncWeakKnowledge = async ({
  userId,
  mode,
  roundId,
  reviewSummary,
  runResult,
  candidates,
}: SyncWeakKnowledgeInput): Promise<SyncWeakKnowledgeResult> => {
  const result: SyncWeakKnowledgeResult = {
    added: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  if (!userId || candidates.length === 0) {
    return result;
  }

  const now = toDateTime(new Date());
  const normalizedCandidates = candidates
    .filter((candidate) => candidate.knowledge_id && candidate.knowledge_name)
    .map((candidate) => normalizeCandidate(candidate, now))
    .filter((candidate) => candidate.weak_score > 0);

  if (normalizedCandidates.length === 0) {
    return result;
  }

  let profileLoaded = true;
  let existingList: WeakKnowledgePoint[] = [];
  try {
    existingList = await getExistingWeakKnowledge(userId);
  } catch (error) {
    profileLoaded = false;
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`load_profile_failed:${message}`);
  }

  const existingMap = new Map(existingList.map((item) => [item.knowledge_id, item]));

  for (const candidate of normalizedCandidates) {
    const idempotentKey = roundId ? `${userId}:${roundId}:${candidate.knowledge_id}` : null;
    if (idempotentKey && isSeenInRound(idempotentKey)) {
      result.skipped += 1;
      continue;
    }

    const existing = existingMap.get(candidate.knowledge_id);
    const merged = existing ? mergeWithExisting(existing, candidate, now) : candidate;

    try {
      if (profileLoaded) {
        if (existing) {
          await updateWeakKnowledge(userId, merged, { mode, roundId, reviewSummary, runResult });
          result.updated += 1;
        } else {
          await appendWeakKnowledge(userId, merged, { mode, roundId, reviewSummary, runResult });
          result.added += 1;
        }
      } else {
        try {
          await updateWeakKnowledge(userId, merged, { mode, roundId, reviewSummary, runResult });
          result.updated += 1;
        } catch (error) {
          const profileError = error instanceof ProfileSyncError ? error : new ProfileSyncError(String(error));
          if (profileError.status === 404) {
            await appendWeakKnowledge(userId, merged, { mode, roundId, reviewSummary, runResult });
            result.added += 1;
          } else {
            throw profileError;
          }
        }
      }

      existingMap.set(candidate.knowledge_id, merged);
      if (idempotentKey) {
        markSeenInRound(idempotentKey);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`write_failed:${candidate.knowledge_id}:${message}`);
    }
  }

  return result;
};
