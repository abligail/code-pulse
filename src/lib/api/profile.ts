import { apiGet } from '@/lib/api/client';

export interface WeakPoint {
  name: string;
  nodeType: string;
  mastery: 1 | 2 | 3 | 4 | 5;
  lastSeen: string;
}

export interface ErrorStat {
  type: string;
  count: number;
}

export interface ReviewPlan {
  name: string;
  nextAt: string;
}

export interface ReviewQueueItem {
  nodeId: string;
  name: string;
  dueAt: string;
  reason: 'ebbinghaus' | 'weak' | 'teacher';
}

export interface UserProfile {
  weakPoints: WeakPoint[];
  errorStats: ErrorStat[];
  reviewPlan: ReviewPlan[];
  reviewQueue?: ReviewQueueItem[];
  lastQuestion?: { id: string; title: string; askedAt: string };
}

export const fetchUserProfile = () => apiGet<UserProfile>('/api/profile/me');
