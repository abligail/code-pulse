import { getActiveUser } from '@/lib/auth/session';

type ApiFetchOptions = RequestInit & { parseJson?: boolean };

const withUserHeaders = (headers?: HeadersInit) => {
  const merged = new Headers(headers || {});
  if (!merged.has('Content-Type')) {
    merged.set('Content-Type', 'application/json');
  }
  const userId = getActiveUser()?.userId;
  if (userId) {
    merged.set('x-user-id', userId);
  }
  return merged;
};

export const apiFetch = async <T>(url: string, options: ApiFetchOptions = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: withUserHeaders(options.headers),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  if (options.parseJson === false) {
    return null as T;
  }

  return (await response.json()) as T;
};

export const apiGet = <T>(url: string, options: ApiFetchOptions = {}) =>
  apiFetch<T>(url, { ...options, method: 'GET' });

export const apiPost = <T>(url: string, body: unknown, options: ApiFetchOptions = {}) =>
  apiFetch<T>(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
