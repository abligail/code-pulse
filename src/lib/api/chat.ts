import { apiGet, apiPost } from '@/lib/api/client';

export interface ChatEntity {
  name: string;
  type: string;
}

export interface ChatResponse {
  answer: string;
  followups?: string[];
  entities?: ChatEntity[];
  questionCard?: {
    title: string;
    prompt: string;
    hints: string[];
  };
}

export interface KnowledgeCard {
  id: string;
  title: string;
  nodeType: string;
  sections: Array<{ name: '定义' | '语法' | '常见坑' | '示例' | '相关概念'; content: string }>;
}

export const sendChatMessage = (payload: { sessionId: string; message: string }) =>
  apiPost<ChatResponse>('/api/chat', payload);

export const fetchKnowledgeCards = (entities: ChatEntity[]) => {
  const params = new URLSearchParams({
    entities: entities.map((entity) => entity.name).join(','),
  });
  return apiGet<{ cards: KnowledgeCard[] }>(`/api/graph/cards?${params.toString()}`);
};
