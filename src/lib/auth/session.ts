export type UserRole = 'student' | 'teacher';

export interface LocalUser {
  userId: string;
  name: string;
  role: UserRole;
  className?: string;
  createdAt: string;
}

export interface LastQuestion {
  id: string;
  title: string;
  askedAt: string;
}

const ACTIVE_USER_KEY = 'cl-active-user';
const USER_LIST_KEY = 'cl-user-list';
const LAST_QUESTION_KEY = 'cl-last-question';

const safeParse = <T>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const isBrowser = () => typeof window !== 'undefined';

export const generateUserId = () => {
  const timePart = Date.now().toString(36);
  const randPart = Math.random().toString(36).slice(2, 8);
  return `u_${timePart}_${randPart}`;
};

export const getActiveUser = (): LocalUser | null => {
  if (!isBrowser()) return null;
  return safeParse<LocalUser>(window.localStorage.getItem(ACTIVE_USER_KEY));
};

export const setActiveUser = (user: LocalUser) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(user));
  upsertUser(user);
};

export const clearActiveUser = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACTIVE_USER_KEY);
};

export const listUsers = (): LocalUser[] => {
  if (!isBrowser()) return [];
  return safeParse<LocalUser[]>(window.localStorage.getItem(USER_LIST_KEY)) || [];
};

export const upsertUser = (user: LocalUser) => {
  if (!isBrowser()) return;
  const users = listUsers();
  const idx = users.findIndex((item) => item.userId === user.userId);
  if (idx >= 0) {
    users[idx] = user;
  } else {
    users.unshift(user);
  }
  window.localStorage.setItem(USER_LIST_KEY, JSON.stringify(users.slice(0, 20)));
};

export const findUserById = (userId: string) => {
  if (!isBrowser()) return null;
  return listUsers().find((user) => user.userId === userId) || null;
};

export const getLastQuestion = (userId: string | undefined): LastQuestion | null => {
  if (!isBrowser() || !userId) return null;
  const map = safeParse<Record<string, LastQuestion>>(window.localStorage.getItem(LAST_QUESTION_KEY)) || {};
  return map[userId] || null;
};

export const setLastQuestion = (userId: string | undefined, question: LastQuestion) => {
  if (!isBrowser() || !userId) return;
  const map = safeParse<Record<string, LastQuestion>>(window.localStorage.getItem(LAST_QUESTION_KEY)) || {};
  map[userId] = question;
  window.localStorage.setItem(LAST_QUESTION_KEY, JSON.stringify(map));
};
