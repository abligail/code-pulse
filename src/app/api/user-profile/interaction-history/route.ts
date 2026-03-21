import { NextResponse } from 'next/server';

const PROFILE_API_BASE =
  process.env.MONGODB_PROFILE_API_BASE?.trim() ||
  process.env.PROFILE_API_BASE_URL?.trim() ||
  process.env.DKT_API_BASE?.trim() ||
  'http://127.0.0.1:8000';

const parseJsonSafely = async (res: Response) => {
  const rawText = await res.text().catch(() => '');
  if (!rawText) return null;
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return rawText;
  }
};

const getInteractionHistoryFromProfile = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return null;
  const container = payload as Record<string, unknown>;
  const profile =
    container.user_profile && typeof container.user_profile === 'object'
      ? (container.user_profile as Record<string, unknown>)
      : container;
  const interactionHistory = profile.interaction_history;
  return Array.isArray(interactionHistory) ? interactionHistory : [];
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const baseUrl = PROFILE_API_BASE.replace(/\/+$/, '');
  const profileUrl = `${baseUrl}/api/mongodb/user_profile/${encodeURIComponent(userId)}`;
  const fallbackProfileUrl = `${baseUrl}/users/${encodeURIComponent(userId)}`;
  const fallbackInteractionHistoryUrl = `${baseUrl}/users/${encodeURIComponent(userId)}/interaction_history`;

  try {
    const profileRes = await fetch(profileUrl, { cache: 'no-store' });
    if (profileRes.ok) {
      const profilePayload = await parseJsonSafely(profileRes);
      const interactionHistory = getInteractionHistoryFromProfile(profilePayload);
      return NextResponse.json({
        user_id: userId,
        interaction_history: interactionHistory ?? [],
      });
    }

    if (profileRes.status !== 404) {
      const body = await profileRes.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'Upstream error',
          status: profileRes.status,
          message: body.slice(0, 240),
          upstream: profileUrl,
        },
        { status: 502 }
      );
    }

    const fallbackProfileRes = await fetch(fallbackProfileUrl, { cache: 'no-store' });
    if (fallbackProfileRes.ok) {
      const profilePayload = await parseJsonSafely(fallbackProfileRes);
      const interactionHistory = getInteractionHistoryFromProfile(profilePayload);
      return NextResponse.json({
        user_id: userId,
        interaction_history: interactionHistory ?? [],
      });
    }

    if (fallbackProfileRes.status !== 404) {
      const body = await fallbackProfileRes.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'Upstream error',
          status: fallbackProfileRes.status,
          message: body.slice(0, 240),
          upstream: fallbackProfileUrl,
        },
        { status: 502 }
      );
    }

    const fallbackInteractionHistoryRes = await fetch(fallbackInteractionHistoryUrl, { cache: 'no-store' });
    if (fallbackInteractionHistoryRes.ok) {
      const data = await fallbackInteractionHistoryRes.json();
      return NextResponse.json(data);
    }

    const body = await fallbackInteractionHistoryRes.text().catch(() => '');
    return NextResponse.json(
      {
        error: 'Upstream error',
        status: fallbackInteractionHistoryRes.status,
        message: body.slice(0, 240),
        upstream: fallbackInteractionHistoryUrl,
      },
      { status: 502 }
    );
  } catch (error) {
    console.error('Proxy interaction history failed', error);
    return NextResponse.json(
      { error: 'Proxy failed', upstream: profileUrl },
      { status: 502 }
    );
  }
}
