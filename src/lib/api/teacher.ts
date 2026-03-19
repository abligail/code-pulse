import { apiGet } from '@/lib/api/client';
import type { TeacherRequirementDTO } from '@/lib/api/types';

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
