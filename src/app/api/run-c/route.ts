import { NextRequest, NextResponse } from 'next/server';
import type { RunResult } from '@/lib/api/review';
import { runCCode } from '@/server/review/run-c';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CODE_LENGTH = 40_000;
const MAX_INPUT_LENGTH = 8_192;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { code?: unknown; input?: unknown };
    const code = typeof body.code === 'string' ? body.code : '';
    const input = typeof body.input === 'string' ? body.input : undefined;

    if (!code.trim()) {
      return NextResponse.json(
        { error: 'code is required' },
        { status: 400 }
      );
    }

    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json(
        { error: `code is too long, max length is ${MAX_CODE_LENGTH}` },
        { status: 400 }
      );
    }

    if (input && input.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        { error: `input is too long, max length is ${MAX_INPUT_LENGTH}` },
        { status: 400 }
      );
    }

    const response = await runCCode({ code, input });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Run code API error:', error);
    const fallback: RunResult = {
      success: false,
      errorType: '平台错误',
      errorSummary: '代码运行服务内部异常',
      error: error instanceof Error ? error.message : String(error),
    };
    return NextResponse.json(fallback);
  }
}
