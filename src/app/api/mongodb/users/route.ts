import { NextResponse } from 'next/server';
import { getUserCollection, type BasicUserDocument, type BasicUserRole } from '@/server/mongodb/client';

const ok = () => NextResponse.json({ success: true });

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const isRole = (value: unknown): value is BasicUserRole => value === 'student' || value === 'teacher';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = normalizeString(body.userId);
    const name = normalizeString(body.name);
    const className = normalizeString(body.className);
    const role = body.role;
    const createdAt = normalizeString(body.createdAt) || new Date().toISOString();

    if (!userId || !name || !isRole(role)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const col = await getUserCollection();
    const now = new Date().toISOString();
    await col.updateOne(
      { userId },
      {
        $set: {
          userId,
          name,
          role,
          className: className || undefined,
          updatedAt: now,
        },
        $setOnInsert: { createdAt },
      },
      { upsert: true }
    );

    return ok();
  } catch (error) {
    console.error('Upsert user failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ids = url.searchParams.getAll('id').map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const col = await getUserCollection();
    const docs = await col
      .find({ userId: { $in: ids } }, { projection: { _id: 0 } })
      .limit(200)
      .toArray();

    return NextResponse.json({ users: docs satisfies BasicUserDocument[] });
  } catch (error) {
    console.error('Fetch users failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
