import { NextRequest, NextResponse } from 'next/server';
import type { ReviewResult, RunResult } from '@/lib/api/review';
import { assessReview, type ReviewMode } from '@/server/review/review-engine';
import { syncWeakKnowledge } from '@/server/review/profile-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isReviewMode = (mode: unknown): mode is ReviewMode =>
  mode === 'syntax' || mode === 'style' || mode === 'logic';

const parseRunResult = (value: unknown): RunResult | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const maybe = value as Partial<RunResult>;
  if (typeof maybe.success !== 'boolean') return undefined;
  return maybe as RunResult;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { code?: unknown; mode?: unknown; runResult?: unknown; roundId?: unknown };
    const code = typeof body.code === 'string' ? body.code : '';
    const mode = body.mode;
    const runResult = parseRunResult(body.runResult);
    const roundId = typeof body.roundId === 'string' ? body.roundId : undefined;

    if (!code.trim() || !isReviewMode(mode)) {
      return NextResponse.json(
        { error: 'code and mode are required' },
        { status: 400 }
      );
    }

    const assessment = assessReview({
      code,
      mode,
      runResult,
    });

    const userId = request.headers.get('x-user-id')?.trim();
    if (userId && assessment.weakCandidates.length > 0) {
      try {
        const syncResult = await syncWeakKnowledge({
          userId,
          mode,
          roundId,
          reviewSummary: assessment.review.summary,
          runResult,
          candidates: assessment.weakCandidates,
        });
        if (syncResult.errors.length > 0) {
          console.warn('Review weak-knowledge sync partial failure', {
            userId,
            roundId,
            mode,
            errors: syncResult.errors,
          });
        }
      } catch (error) {
        console.warn('Review weak-knowledge sync failed', {
          userId,
          roundId,
          mode,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json(assessment.review);
  } catch (error) {
    console.error('Review API error:', error);
    const fallback: ReviewResult = {
      status: 'error',
      summary: '评审服务内部异常，请稍后重试。',
      details: [],
      suggestions: [],
      questions: [],
    };
    return NextResponse.json(fallback);
  }
}
