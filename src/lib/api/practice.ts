import { apiGet, apiPost } from '@/lib/api/client';

export type PracticeSource = 'weak' | 'teacher' | 'review' | 'system';

export interface PracticeItem {
  id: string;
  title: string;
  topic: string;
  level: string;
  status: 'new' | 'done' | 'in_progress';
  source?: PracticeSource;
  sourceNote?: string;
  adaptiveLevel?: '入门' | '基础' | '提高';
  adaptiveNote?: string;
}

export interface PracticeDetail {
  id: string;
  title: string;
  promptMarkdown: string;
  ioDesc: string;
  samples: Array<{ input: string; output: string }>;
}

export interface SubmitResult {
  status: 'pass' | 'fail';
  score: number;
  feedback: string;
  hints: string[];
}

export const fetchPracticeList = (topic?: string, level?: string) => {
  const params = new URLSearchParams();
  if (topic && topic !== 'all') params.append('topic', topic);
  if (level && level !== 'all') params.append('level', level);
  return apiGet<{ items: PracticeItem[] }>(`/api/practice/list?${params.toString()}`);
};

export const fetchPracticeDetail = (id: string) =>
  apiGet<PracticeDetail>(`/api/practice/detail?id=${id}`);

export const submitPractice = (payload: { id: string; code: string }) =>
  apiPost<SubmitResult>('/api/practice/submit', payload);
