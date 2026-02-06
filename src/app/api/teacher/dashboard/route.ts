import { NextRequest, NextResponse } from 'next/server';
import { mockTeacherDashboard } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId') || undefined;
    const range = searchParams.get('range') || undefined;

    // TODO: Connect to real database (integration-postgre-database)
    // For now, use mock data
    const response = mockTeacherDashboard(classId, range);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Teacher dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
