import { NextRequest, NextResponse } from 'next/server';
import { mockKnowledgeCards } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entities = searchParams.get('entities');

    // TODO: Connect to real knowledge base service (integration-knowledge-base)
    // For now, use mock data
    const response = mockKnowledgeCards();

    return NextResponse.json(response);
  } catch (error) {
    console.error('Knowledge cards API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
