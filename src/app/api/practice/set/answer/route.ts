import { NextResponse } from 'next/server';
import { parseJsonBody, proxyPost, readOption, readString, readUserId } from '@/app/api/practice/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  const userId = readUserId(request, body.user_id);

  const rawAnswers = Array.isArray(body.answers) ? body.answers : [];
  const answers = rawAnswers
    .map((item) => {
      const answer = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const questionId = readString(answer.question_id);
      const selectedOption = readOption(answer.selected_option);
      if (!questionId || !selectedOption) return null;
      return {
        question_id: questionId,
        selected_option: selectedOption,
      };
    })
    .filter((item): item is { question_id: string; selected_option: 'A' | 'B' | 'C' | 'D' } => Boolean(item));

  if (!userId || answers.length === 0) {
    return NextResponse.json(
      { error: 'user_id and valid answers[] are required' },
      { status: 400 }
    );
  }

  return proxyPost('/questions/set/answer', {
    user_id: userId,
    answers,
  });
}

