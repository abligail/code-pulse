import { NextRequest, NextResponse } from 'next/server';
import { mockPracticeList } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic') || undefined;
    const level = searchParams.get('level') || undefined;

    // TODO: Connect to real database (integration-postgre-database)
    // For now, use mock data
    const response = mockPracticeList(topic, level);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Practice list API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
