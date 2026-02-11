import { NextResponse } from 'next/server';

const PROFILE_API_BASE =
  process.env.MONGODB_PROFILE_API_BASE?.trim() ||
  process.env.PROFILE_API_BASE_URL?.trim() ||
  'http://127.0.0.1:5000';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const upstream = `${PROFILE_API_BASE.replace(/\/+$/, '')}/api/mongodb/user_profile/${encodeURIComponent(userId)}`;

  try {
    const res = await fetch(upstream, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream error', status: res.status }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy user profile failed', error);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
  }
}
