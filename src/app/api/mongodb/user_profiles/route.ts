import { NextResponse } from 'next/server';

const PROFILE_API_BASE =
  process.env.MONGODB_PROFILE_API_BASE?.trim() ||
  process.env.PROFILE_API_BASE_URL?.trim() ||
  'http://127.0.0.1:5000';

export async function GET(req: Request) {
  const nextUrl = new URL(req.url);
  const upstreamUrl = new URL(
    `${PROFILE_API_BASE.replace(/\/+$/, '')}/api/mongodb/user_profiles`
  );
  nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  try {
    const res = await fetch(upstreamUrl, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: 'Upstream error', status: res.status, body },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy user profiles failed', error);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
  }
}
