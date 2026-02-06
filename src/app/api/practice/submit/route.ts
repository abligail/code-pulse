import { NextRequest, NextResponse } from 'next/server';
import { mockPracticeSubmit } from '@/lib/mock-data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, code } = body;

    if (!id || !code) {
      return NextResponse.json(
        { error: 'id and code are required' },
        { status: 400 }
      );
    }

    // TODO: Connect to real code execution and evaluation service
    // For now, use mock data
    const response = mockPracticeSubmit(id, code);

    // Simulate evaluation delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Practice submit API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
