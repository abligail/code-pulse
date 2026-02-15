import { NextResponse } from 'next/server';

const PRACTICE_API_BASE =
  process.env.DKT_API_BASE?.trim() ||
  process.env.MONGODB_PROFILE_API_BASE?.trim() ||
  process.env.PROFILE_API_BASE_URL?.trim() ||
  'http://127.0.0.1:8000';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const parseJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  try {
    const body = (await request.json()) as unknown;
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
};

export const readString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

export const readNumber = (value: unknown, fallback: number, min?: number, max?: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const withMin = typeof min === 'number' ? Math.max(min, parsed) : parsed;
  return typeof max === 'number' ? Math.min(max, withMin) : withMin;
};

export const readInteger = (value: unknown, fallback: number, min?: number, max?: number) => {
  const parsed = Math.round(readNumber(value, fallback, min, max));
  if (typeof min === 'number' && parsed < min) return min;
  if (typeof max === 'number' && parsed > max) return max;
  return parsed;
};

export const readUserId = (request: Request, bodyUserId: unknown) => {
  const fromBody = readString(bodyUserId);
  if (fromBody) return fromBody;
  const fromHeader = readString(request.headers.get('x-user-id'));
  return fromHeader;
};

export const readOption = (value: unknown) => {
  const option = readString(value).toUpperCase();
  return option === 'A' || option === 'B' || option === 'C' || option === 'D' ? option : '';
};

const parseResponsePayload = (rawText: string) => {
  if (!rawText) return {};
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return { message: rawText };
  }
};

export const proxyPost = async (path: string, payload: Record<string, unknown>) => {
  const upstream = `${PRACTICE_API_BASE.replace(/\/+$/, '')}${path}`;
  try {
    const res = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const rawText = await res.text();
    const data = parseResponsePayload(rawText);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`Practice proxy failed (${path})`, error);
    return NextResponse.json(
      { error: 'Practice proxy failed' },
      { status: 502 }
    );
  }
};

