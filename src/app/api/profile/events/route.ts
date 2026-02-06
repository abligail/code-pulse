import { NextRequest, NextResponse } from 'next/server';
import type { UserEventDTO } from '@/lib/api/types';

const eventStore: UserEventDTO[] = [];

const getUserId = (request: NextRequest) => {
  const headerId = request.headers.get('x-user-id');
  if (headerId) return headerId;
  const { searchParams } = new URL(request.url);
  return searchParams.get('userId');
};

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || 0);

    const filtered = userId ? eventStore.filter((event) => event.userId === userId) : eventStore;
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
