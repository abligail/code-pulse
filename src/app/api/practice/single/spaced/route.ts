import { NextResponse } from 'next/server';
import { parseJsonBody, proxyPost, readInteger, readNumber, readString, readUserId } from '@/app/api/practice/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  const userId = readUserId(request, body.user_id);
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const payload = {
    user_id: userId,
    zpd_min: readNumber(body.zpd_min, 0.6, 0, 1),
    zpd_max: readNumber(body.zpd_max, 0.8, 0, 1),
    expected_mode: readString(body.expected_mode, 'min'),
    interval_days: readInteger(body.interval_days, 7, 1),
    alpha: readNumber(body.alpha, 0.6, 0, 1),
    beta: readNumber(body.beta, 0.4, 0, 1),
    mastery_threshold: readNumber(body.mastery_threshold, 0.6, 0, 1),
    top_k_review: readInteger(body.top_k_review, 5, 1),
    top_k_weak: readInteger(body.top_k_weak, 5, 1),
    max_candidates: readInteger(body.max_candidates, 2000, 1),
  };

  return proxyPost('/questions/single/spaced', payload);
}

