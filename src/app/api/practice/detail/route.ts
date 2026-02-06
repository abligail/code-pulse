import { NextRequest, NextResponse } from 'next/server';
import { mockPracticeDetail } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    // TODO: Connect to real database (integration-postgre-database)
    // For now, use mock data
    const response = mockPracticeDetail(id);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Practice detail API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
