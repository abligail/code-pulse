export const QUIZ_HISTORY_STORAGE_KEY = 'code-pulse/quiz-history';
export const QUIZ_HISTORY_EVENT = 'code-pulse:quiz-history-updated';

const normalizeUserId = (userId?: string | null) => {
  const trimmed = (userId ?? '').trim();
  return trimmed || 'guest';
};

export const getQuizHistoryStorageKey = (userId?: string | null) =>
  `${QUIZ_HISTORY_STORAGE_KEY}/${normalizeUserId(userId)}`;

const readOrMigrateHistoryValue = (scopedKey: string): string | null => {
  if (typeof window === 'undefined') return null;
  const scopedValue = localStorage.getItem(scopedKey);
  if (scopedValue !== null) return scopedValue;
  if (scopedKey === QUIZ_HISTORY_STORAGE_KEY) return scopedValue;
  const legacyValue = localStorage.getItem(QUIZ_HISTORY_STORAGE_KEY);
  if (legacyValue === null) return null;
  try {
    localStorage.setItem(scopedKey, legacyValue);
    localStorage.removeItem(QUIZ_HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to migrate quiz history storage', error);
  }
  return legacyValue;
};

export type QuizHistoryCheckState = 'correct' | 'wrong' | 'skip';

export interface QuizHistoryQuestion {
  stem: string;
  type: string;
  options: string[];
  userAnswer: string;
  referenceAnswer?: string;
  analysis?: string;
  checkResult: QuizHistoryCheckState;
}

export interface QuizHistoryEntry {
  id: string;
  knowledgeId: string;
  knowledgeName: string;
  knowledgeCategory: string[];
  occurredAt: string;
  review: string;
  questions: QuizHistoryQuestion[];
}

const safeParse = (raw: string | null): QuizHistoryEntry[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QuizHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse quiz history', error);
    return [];
  }
};

const dispatchHistoryEvent = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(QUIZ_HISTORY_EVENT));
};

export const readQuizHistoryEntries = (userId?: string | null): QuizHistoryEntry[] => {
  if (typeof window === 'undefined') return [];
  const scopedKey = getQuizHistoryStorageKey(userId);
  const raw = readOrMigrateHistoryValue(scopedKey);
  return safeParse(raw);
};

export const writeQuizHistoryEntries = (entries: QuizHistoryEntry[], userId?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getQuizHistoryStorageKey(userId), JSON.stringify(entries));
    dispatchHistoryEvent();
  } catch (error) {
    console.error('Failed to persist quiz history', error);
  }
};

export const appendQuizHistoryEntry = (
  entry: QuizHistoryEntry,
  options?: { limit?: number; userId?: string | null }
): void => {
  if (typeof window === 'undefined') return;
  const limit = options?.limit ?? 40;
  const userId = options?.userId;
  const list = readQuizHistoryEntries(userId);
  const next = [entry, ...list].slice(0, limit);
  writeQuizHistoryEntries(next, userId);
};
