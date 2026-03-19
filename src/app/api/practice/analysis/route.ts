import { NextResponse } from 'next/server';
import { parseJsonBody, readString, readUserId } from '@/app/api/practice/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COZE_WORKFLOW_URL = 'https://api.coze.cn/v1/workflow/stream_run';
const PRACTICE_ANALYSIS_WORKFLOW_ID = '7607064355598762019';
const COZE_API_TOKEN =
  process.env.COZE_API_TOKEN?.trim() ||
  process.env.COZE_API_PAT?.trim() ||
  'pat_AZJaFLL61tgYMtoO9yQlyPPvo6d3lUmqOxJRyGeAoiiIFrfUdeUiJdICC5q8jxcG';
const OPTION_ORDER = ['A', 'B', 'C', 'D'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const formatOptions = (value: unknown) => {
  if (Array.isArray(value)) {
    return OPTION_ORDER.map((key, index) => `${key}. ${asText(value[index]) || '（无）'}`).join('\n');
  }
  if (isRecord(value)) {
    return OPTION_ORDER.map((key) => `${key}. ${asText(value[key]) || '（无）'}`).join('\n');
  }
  return OPTION_ORDER.map((key) => `${key}. （无）`).join('\n');
};

const getSingleInput = (payload: unknown, userReply: string) => {
  const data = isRecord(payload) ? payload : {};
  const stem = asText(data.question_stem ?? data.question_text ?? data.stem, '（无题干）');
  const selectedOption = asText(data.selected_option ?? data.student_answer, '未知');
  const correctOption = asText(data.correct_option ?? data.reference_answer, '未知');
  const optionsText = formatOptions(data.options);
  return [
    `题干：${stem}`,
    '选项：',
    optionsText,
    `学生答案：${selectedOption}`,
    `正确答案：${correctOption}`,
    `用户补充：${userReply}`,
  ].join('\n');
};

const getSetInput = (payload: unknown, userReply: string) => {
  const data = isRecord(payload) ? payload : {};
  const questions = Array.isArray(data.questions) ? data.questions : [];
  if (questions.length === 0) {
    return userReply;
  }
  const questionBlocks = questions.map((item, index) => {
    const question = isRecord(item) ? item : {};
    const stem = asText(question.question_stem ?? question.question_text ?? question.stem, '（无题干）');
    const selectedOption = asText(question.selected_option ?? question.student_answer, '未知');
    const correctOption = asText(question.correct_option ?? question.reference_answer, '未知');
    const optionsText = formatOptions(question.options);
    return [
      `第${index + 1}题：`,
      `题干：${stem}`,
      '选项：',
      optionsText,
      `学生答案：${selectedOption}`,
      `正确答案：${correctOption}`,
    ].join('\n');
  });
  return [...questionBlocks, `用户补充：${userReply}`].join('\n\n');
};

const buildWorkflowInput = (mode: string, payload: unknown, userReply: string) => {
  if (mode === 'set') return getSetInput(payload, userReply);
  return getSingleInput(payload, userReply);
};

const parseWorkflowOutput = (text: string): string | null => {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (typeof parsed.output === 'string') return parsed.output;
    if (typeof parsed.content === 'string') {
      try {
        const inner = JSON.parse(parsed.content) as Record<string, unknown>;
        if (typeof inner.output === 'string') return inner.output;
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (typeof parsed.output === 'string') return parsed.output;
    if (typeof parsed.content === 'string') {
      try {
        const inner = JSON.parse(parsed.content) as Record<string, unknown>;
        if (typeof inner.output === 'string') return inner.output;
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
  return null;
};

export async function POST(request: Request) {
  if (!COZE_API_TOKEN) {
    return NextResponse.json({ error: 'Missing COZE_API_TOKEN' }, { status: 500 });
  }

  const body = await parseJsonBody(request);
  const userId = readUserId(request, body.user_id) || 'guest';
  const mode = readString(body.mode, 'single');
  const payload = body.payload;

  if (!payload || (typeof payload !== 'object' && !Array.isArray(payload))) {
    return NextResponse.json({ error: 'payload is required' }, { status: 400 });
  }

  const userReply = readString(body.user_reply, mode === 'set' ? '学生已完成整套题作答。' : '学生已完成本题作答。');
  const input = buildWorkflowInput(mode, payload, userReply);
  const inputPreview = input.length > 300 ? `${input.slice(0, 300)}...` : input;
  console.info('[practice-analysis] Coze request', {
    mode,
    userId,
    inputLength: input.length,
    inputPreview,
  });

  try {
    const response = await fetch(COZE_WORKFLOW_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${COZE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: PRACTICE_ANALYSIS_WORKFLOW_ID,
        parameters: {
          input,
          uuid: userId,
        },
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      return NextResponse.json(
        { error: 'Workflow request failed', status: response.status, message: bodyText.slice(0, 240) },
        { status: 502 }
      );
    }

    if (!response.body) {
      return NextResponse.json({ analysis: '' });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let output = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const parsed = parseWorkflowOutput(trimmed.slice(5).trim());
        if (parsed) output = parsed;
      }
    }

    if (!output) {
      output = parseWorkflowOutput(buffer) || '';
    }

    return NextResponse.json({ analysis: output });
  } catch (error) {
    console.error('Practice analysis workflow failed', error);
    return NextResponse.json({ error: 'Practice analysis workflow failed' }, { status: 502 });
  }
}
