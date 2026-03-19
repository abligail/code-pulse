import { NextResponse } from 'next/server';
import { parseJsonBody, proxyPut, readInteger, readUserId } from '@/app/api/practice/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const body = await parseJsonBody(request);
  const userId = readUserId(request, body.user_id);
  const rawIntervalDays = body.interval_days;

  if (!userId || rawIntervalDays === undefined || rawIntervalDays === null) {
    return NextResponse.json(
      { error: 'user_id and interval_days (1~365) are required' },
      { status: 400 }
    );
  }

  const intervalDays = readInteger(rawIntervalDays, 7, 1, 365);

  return proxyPut(`/users/${encodeURIComponent(userId)}/interval_days`, {
    interval_days: intervalDays,
  });
}
