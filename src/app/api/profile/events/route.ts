import { NextRequest, NextResponse } from 'next/server';
import type { UserEventDTO, UserEventType } from '@/lib/api/types';

const eventStore: UserEventDTO[] = [];

const getUserId = (request: NextRequest) => {
  const headerId = request.headers.get('x-user-id');
  if (headerId) return headerId;
  const { searchParams } = new URL(request.url);
  return searchParams.get('userId');
};

const getQueryValue = (searchParams: URLSearchParams, key: string) => {
  const raw = searchParams.get(key);
  if (!raw) return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
};

const parseLimit = (value: string | null) => {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
};

const isEventType = (value: string): value is UserEventType =>
  value === 'chat_round'
  || value === 'practice_submit'
  || value === 'review_run'
  || value === 'quiz_submit'
  || value === 'knowledge_card_open'
  || value === 'teacher_assignment';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = getUserId(request);
    const eventTypeQuery = getQueryValue(searchParams, 'eventType');
    const source = getQueryValue(searchParams, 'source');
    const limit = parseLimit(searchParams.get('limit'));

    let filtered = eventStore.slice();
    if (userId) {
      filtered = filtered.filter((event) => event.userId === userId);
    }
    if (eventTypeQuery && isEventType(eventTypeQuery)) {
      filtered = filtered.filter((event) => event.eventType === eventTypeQuery);
    }
    if (source) {
      filtered = filtered.filter((event) => event.source === source);
    }

    const ordered = filtered
      .slice()
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );

    return NextResponse.json({
      events: limit > 0 ? ordered.slice(0, limit) : ordered,
    });
  } catch (error) {
    console.error('User events API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Partial<UserEventDTO>;

    if (!payload.userId || !payload.eventType || !payload.occurredAt) {
      return NextResponse.json(
        { error: 'userId, eventType, occurredAt are required' },
        { status: 400 }
      );
    }

    eventStore.push(payload as UserEventDTO);
    if (eventStore.length > 500) {
      eventStore.shift();
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('User events API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
