import { apiGet } from '@/lib/api/client';
import type { QuestionClusterDTO, TeacherRequirementDTO } from '@/lib/api/types';

export interface DashboardData {
  completionRate: Array<{ label: string; rate: number }>;
  errorTop: Array<{ type: string; count: number }>;
  weakTop: Array<{ name: string; score: number }>;
  students: Array<{
    id: string;
    name: string;
    questionsPerWeek: number;
    practiceAccuracy: number;
    weak: string[];
  }>;
  clusters?: QuestionClusterDTO[];
}

export interface WeakKnowledgePointDTO {
  knowledge_id: string;
  knowledge_name: string;
  knowledge_category?: string[];
  weak_reason?: string;
  weak_score?: number;
  first_weak_time?: string;
  last_review_time?: string | null;
  review_count?: number;
}

export interface UserProfileRecordDTO {
  user_id: string;
  user_name?: string;
  profile_update_time?: string;
  weak_knowledge?: WeakKnowledgePointDTO[];
  [key: string]: unknown;
}

export interface UserProfilesResponseDTO {
  status: string;
  count: number;
  users: UserProfileRecordDTO[];
}

export const fetchTeacherDashboard = (classId?: string, range?: string) => {
  const params = new URLSearchParams();
  if (classId && classId !== 'all') params.append('classId', classId);
  if (range && range !== 'all') params.append('range', range);
  return apiGet<DashboardData>(`/api/teacher/dashboard?${params.toString()}`);
};

export const fetchTeacherRequirements = (classId?: string) => {
  const params = new URLSearchParams();
  if (classId && classId !== 'all') params.append('classId', classId);
  return apiGet<TeacherRequirementDTO>(`/api/teacher/requirements?${params.toString()}`);
};

export const fetchAllUserProfiles = (options?: { limit?: number; skip?: number; onlyWeak?: boolean }) => {
  const params = new URLSearchParams();
  if (typeof options?.limit === 'number' && options.limit > 0) {
    params.append('limit', String(options.limit));
  }
  if (typeof options?.skip === 'number' && options.skip > 0) {
    params.append('skip', String(options.skip));
  }
  if (options?.onlyWeak ?? true) {
    params.append('only_weak', 'true');
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return apiGet<UserProfilesResponseDTO>(`/api/mongodb/user_profiles${suffix}`);
};
