import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Teacher dashboard mock endpoint has been removed. Use real profile-based endpoints instead.' },
    { status: 410 }
  );
}
