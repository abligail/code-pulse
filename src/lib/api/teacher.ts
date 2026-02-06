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
