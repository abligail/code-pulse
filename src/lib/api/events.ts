import { apiGet, apiPost } from '@/lib/api/client';
import { getActiveUser } from '@/lib/auth/session';
import type { UserEventDTO } from '@/lib/api/types';

export type TrackEventInput = Omit<UserEventDTO, 'eventId' | 'userId' | 'occurredAt'> & {
  userId?: string;
  eventId?: string;
  occurredAt?: string;
};

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

export const fetchUserEvents = (limit = 8) => {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  return apiGet<{ events: UserEventDTO[] }>(`/api/profile/events?${params.toString()}`);
};
