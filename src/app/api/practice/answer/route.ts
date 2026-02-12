import { NextResponse } from 'next/server';
import { parseJsonBody, proxyPost, readOption, readString, readUserId } from '@/app/api/practice/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  const userId = readUserId(request, body.user_id);
  const questionId = readString(body.question_id);
  const selectedOption = readOption(body.selected_option);

  if (!userId || !questionId || !selectedOption) {
    return NextResponse.json(
      { error: 'user_id, question_id and selected_option (A/B/C/D) are required' },
      { status: 400 }
    );
  }

  return proxyPost('/questions/answer', {
    user_id: userId,
    question_id: questionId,
    selected_option: selectedOption,
  });
}

