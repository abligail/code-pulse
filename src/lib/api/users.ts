import { apiGet, apiPost } from '@/lib/api/client';
import type { UserRole } from '@/lib/auth/session';

export interface BasicUserDTO {
  userId: string;
  name?: string;
  role?: UserRole;
  className?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const saveBasicUser = (payload: BasicUserDTO) => apiPost<{ success: boolean }>(`/api/mongodb/users`, payload);

export const fetchUserBasics = (ids: string[]) => {
  if (!ids.length) return Promise.resolve<{ users: BasicUserDTO[] }>({ users: [] });
  const params = new URLSearchParams();
  ids.forEach((id) => params.append('id', id));
  const query = params.toString();
  return apiGet<{ users: BasicUserDTO[] }>(`/api/mongodb/users${query ? `?${query}` : ''}`);
};
