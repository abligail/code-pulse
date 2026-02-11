import { NextResponse } from 'next/server';
import { parseJsonBody, proxyPost, readInteger, readNumber, readString, readUserId } from '@/app/api/practice/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const readDifficultyRatio = (value: unknown) => {
  const ratio = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    easy: readNumber(ratio.easy, 0.2, 0, 1),
    medium: readNumber(ratio.medium, 0.6, 0, 1),
    hard: readNumber(ratio.hard, 0.2, 0, 1),
  };
};

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  const userId = readUserId(request, body.user_id);
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const payload = {
    user_id: userId,
    count: readInteger(body.count, 10, 1),
    zpd_min: readNumber(body.zpd_min, 0.5, 0, 1),
    zpd_max: readNumber(body.zpd_max, 0.9, 0, 1),
    expected_mode: readString(body.expected_mode, 'mean'),
    max_candidates: readInteger(body.max_candidates, 3000, 1),
    difficulty_ratio: readDifficultyRatio(body.difficulty_ratio),
  };

  return proxyPost('/questions/set', payload);
}

