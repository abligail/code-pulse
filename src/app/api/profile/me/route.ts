import { NextResponse } from 'next/server';
import { mockUserProfile } from '@/lib/mock-data';

export async function GET() {
  try {
    // TODO: Connect to real database (integration-postgre-database)
    // For now, use mock data
    const response = mockUserProfile();

    return NextResponse.json(response);
  } catch (error) {
    console.error('User profile API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
