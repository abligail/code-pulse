import { NextRequest, NextResponse } from 'next/server';
import { mockRunCode } from '@/lib/mock-data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, input } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'code is required' },
        { status: 400 }
      );
    }

    // TODO: Connect to real code execution sandbox
    // For now, use mock data
    const response = mockRunCode(code, input);

    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 800));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Run code API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
