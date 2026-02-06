import { NextRequest, NextResponse } from 'next/server';
import { mockReview } from '@/lib/mock-data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, mode, runResult } = body;

    if (!code || !mode) {
      return NextResponse.json(
        { error: 'code and mode are required' },
        { status: 400 }
      );
    }

    // TODO: Connect to real LLM service for code review (integration-doubao-seed)
    // For now, use mock data
    const response = mockReview(code, mode, runResult);

    // Simulate review delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Review API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
