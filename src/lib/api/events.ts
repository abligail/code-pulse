import { apiGet, apiPost } from '@/lib/api/client';
import { getActiveUser } from '@/lib/auth/session';
import type { UserEventDTO, UserEventType } from '@/lib/api/types';

export type TrackEventInput = Omit<UserEventDTO, 'eventId' | 'userId' | 'occurredAt'> & {
  userId?: string;
  eventId?: string;
  occurredAt?: string;
};

export interface FetchUserEventsOptions {
  limit?: number;
  eventType?: UserEventType;
  source?: string;
  userId?: string;
}

const createEventId = () => {
  const timePart = Date.now().toString(36);
  const randPart = Math.random().toString(36).slice(2, 8);
  return `ev_${timePart}_${randPart}`;
};

export const logUserEvent = async (input: TrackEventInput) => {
  const userId = input.userId || getActiveUser()?.userId;
  if (!userId) return null;

  const event: UserEventDTO = {
    eventId: input.eventId || createEventId(),
    userId,
    occurredAt: input.occurredAt || new Date().toISOString(),
    eventType: input.eventType,
    source: input.source,
    roundId: input.roundId,
    conversationId: input.conversationId,
    knowledgeNodes: input.knowledgeNodes,
    metrics: input.metrics,
  };

  try {
    await apiPost<{ ok: boolean }>('/api/profile/events', event);
  } catch (error) {
    console.warn('Failed to log user event', error);
  }

  return event;
};

export const fetchUserEvents = (optionsOrLimit: number | FetchUserEventsOptions = 8) => {
  const options = typeof optionsOrLimit === 'number' ? { limit: optionsOrLimit } : optionsOrLimit;
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.eventType) params.set('eventType', options.eventType);
  if (options.source) params.set('source', options.source);
  if (options.userId) params.set('userId', options.userId);
  return apiGet<{ events: UserEventDTO[] }>(`/api/profile/events?${params.toString()}`);
};
