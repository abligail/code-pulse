import { NextResponse } from 'next/server';

const PROFILE_API_BASE =
  process.env.MONGODB_PROFILE_API_BASE?.trim() ||
  process.env.PROFILE_API_BASE_URL?.trim() ||
  process.env.DKT_API_BASE?.trim() ||
  'http://127.0.0.1:8000';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const upstream = `${PROFILE_API_BASE.replace(/\/+$/, '')}/users/${encodeURIComponent(userId)}/interaction_history`;

  try {
    const res = await fetch(upstream, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json(
        { error: 'Upstream error', status: res.status, message: body.slice(0, 240) },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy interaction history failed', error);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
  }
}

