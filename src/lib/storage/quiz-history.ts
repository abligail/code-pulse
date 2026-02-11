export const QUIZ_HISTORY_STORAGE_KEY = 'code-pulse/quiz-history';
export const QUIZ_HISTORY_EVENT = 'code-pulse:quiz-history-updated';

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

export const readQuizHistoryEntries = (): QuizHistoryEntry[] => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(QUIZ_HISTORY_STORAGE_KEY);
  return safeParse(raw);
};

export const writeQuizHistoryEntries = (entries: QuizHistoryEntry[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUIZ_HISTORY_STORAGE_KEY, JSON.stringify(entries));
    dispatchHistoryEvent();
  } catch (error) {
    console.error('Failed to persist quiz history', error);
  }
};

export const appendQuizHistoryEntry = (entry: QuizHistoryEntry, limit = 40): void => {
  if (typeof window === 'undefined') return;
  const list = readQuizHistoryEntries();
  const next = [entry, ...list].slice(0, limit);
  writeQuizHistoryEntries(next);
};
