import { NextRequest, NextResponse } from 'next/server';
import { mockChatResponse } from '@/lib/mock-data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    // TODO: Connect to real LLM service (integration-doubao-seed)
    // For now, use mock data
    const response = mockChatResponse(message);
    
    // Simulate streaming delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
