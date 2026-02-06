import { NextRequest, NextResponse } from 'next/server';
import { mockTeacherRequirements } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId') || undefined;

    const response = mockTeacherRequirements(classId);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Teacher requirements API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
