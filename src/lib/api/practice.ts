import { apiPost } from '@/lib/api/client';

export type PracticeStrategy = 'weakest' | 'spaced';
export type ChoiceOption = 'A' | 'B' | 'C' | 'D';

interface RawQuestion {
  question_id?: unknown;
  question_text?: unknown;
  options?: unknown;
  knowledge_points?: unknown;
  题目ID?: unknown;
  题目类型?: unknown;
  题目描述?: unknown;
  选项?: unknown;
  知识点?: unknown;
}

export interface PracticeQuestion {
  id: string;
  type: string;
  stem: string;
  options: Record<ChoiceOption, string>;
  knowledgePoints: string[];
}

export interface SingleQuestionRequest {
  zpd_min?: number;
  zpd_max?: number;
  expected_mode?: 'min' | 'mean' | 'product';
  score_mode?: 'sum' | 'max' | 'min';
  top_k_weak?: number;
  max_candidates?: number;
  interval_days?: number;
  alpha?: number;
  beta?: number;
  mastery_threshold?: number;
  top_k_review?: number;
}

interface RawSingleQuestionResponse {
  strategy?: string;
  zpd_applied?: boolean;
  question?: RawQuestion;
}

export interface SingleQuestionResponse {
  strategy: PracticeStrategy;
  zpdApplied: boolean;
  question: PracticeQuestion;
}

interface RawSingleAnswerResponse {
  is_correct?: boolean;
  correct_option?: string;
  selected_option?: string;
  updated_kc_mastery?: Record<string, number>;
  profile_update_time?: string;
}

export interface SingleAnswerResponse {
  isCorrect: boolean;
  correctOption: ChoiceOption;
  selectedOption: ChoiceOption;
  updatedKcMastery: Record<string, number>;
  profileUpdateTime: string;
}

export interface QuestionSetRequest {
  count?: number;
  zpd_min?: number;
  zpd_max?: number;
  expected_mode?: 'min' | 'mean' | 'product';
  max_candidates?: number;
  difficulty_ratio?: { easy?: number; medium?: number; hard?: number };
}

interface RawQuestionSetResponse {
  strategy?: string;
  zpd_applied?: boolean;
  questions?: RawQuestion[];
}

export interface QuestionSetResponse {
  strategy: 'set';
  zpdApplied: boolean;
  questions: PracticeQuestion[];
}

interface RawSetAnswerItem {
  question_id?: string;
  is_correct?: boolean;
  correct_option?: string;
  selected_option?: string;
}

interface RawSetAnswerResponse {
  results?: RawSetAnswerItem[];
  updated_kc_mastery?: Record<string, number>;
  profile_update_time?: string;
}

export interface SetAnswerItem {
  questionId: string;
  isCorrect: boolean;
  correctOption: ChoiceOption;
  selectedOption: ChoiceOption;
}

export interface SetAnswerResponse {
  results: SetAnswerItem[];
  updatedKcMastery: Record<string, number>;
  profileUpdateTime: string;
}

const asString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text || fallback;
};

const normalizeOption = (value: unknown): ChoiceOption => {
  const text = asString(value).toUpperCase();
  if (text === 'A' || text === 'B' || text === 'C' || text === 'D') return text;
  return 'A';
};

const normalizeOptions = (raw: unknown): Record<ChoiceOption, string> => {
  if (Array.isArray(raw)) {
    return {
      A: asString(raw[0]),
      B: asString(raw[1]),
      C: asString(raw[2]),
      D: asString(raw[3]),
    };
  }
  if (raw && typeof raw === 'object') {
    const options = raw as Record<string, unknown>;
    return {
      A: asString(options.A ?? options.a),
      B: asString(options.B ?? options.b),
      C: asString(options.C ?? options.c),
      D: asString(options.D ?? options.d),
    };
  }
  return { A: '', B: '', C: '', D: '' };
};

const normalizeKnowledgePoints = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => asString(item)).filter(Boolean);
};

const normalizeQuestion = (raw: RawQuestion | undefined): PracticeQuestion => {
  const optionsRaw = raw?.选项 ?? raw?.options;
  return {
    id: asString(raw?.题目ID ?? raw?.question_id),
    type: asString(raw?.题目类型, '选择题'),
    stem: asString(raw?.题目描述 ?? raw?.question_text),
    options: normalizeOptions(optionsRaw),
    knowledgePoints: normalizeKnowledgePoints(raw?.知识点 ?? raw?.knowledge_points),
  };
};

const normalizeSingleQuestionResponse = (raw: RawSingleQuestionResponse): SingleQuestionResponse => ({
  strategy: raw.strategy === 'spaced' ? 'spaced' : 'weakest',
  zpdApplied: Boolean(raw.zpd_applied),
  question: normalizeQuestion(raw.question),
});

const normalizeSingleAnswerResponse = (raw: RawSingleAnswerResponse): SingleAnswerResponse => ({
  isCorrect: Boolean(raw.is_correct),
  correctOption: normalizeOption(raw.correct_option),
  selectedOption: normalizeOption(raw.selected_option),
  updatedKcMastery: raw.updated_kc_mastery ?? {},
  profileUpdateTime: asString(raw.profile_update_time),
});

const normalizeQuestionSetResponse = (raw: RawQuestionSetResponse): QuestionSetResponse => ({
  strategy: 'set',
  zpdApplied: Boolean(raw.zpd_applied),
  questions: Array.isArray(raw.questions) ? raw.questions.map((item) => normalizeQuestion(item)) : [],
});

const normalizeSetAnswerResponse = (raw: RawSetAnswerResponse): SetAnswerResponse => ({
  results: Array.isArray(raw.results)
    ? raw.results.map((item) => ({
      questionId: asString(item.question_id),
      isCorrect: Boolean(item.is_correct),
      correctOption: normalizeOption(item.correct_option),
      selectedOption: normalizeOption(item.selected_option),
    }))
    : [],
  updatedKcMastery: raw.updated_kc_mastery ?? {},
  profileUpdateTime: asString(raw.profile_update_time),
});

export const fetchSinglePracticeQuestion = async (
  strategy: PracticeStrategy,
  payload: SingleQuestionRequest = {}
) => {
  const raw = await apiPost<RawSingleQuestionResponse>(`/api/practice/single/${strategy}`, payload);
  return normalizeSingleQuestionResponse(raw);
};

export const submitSinglePracticeAnswer = async (payload: {
  question_id: string;
  selected_option: ChoiceOption;
}) => {
  const raw = await apiPost<RawSingleAnswerResponse>('/api/practice/answer', payload);
  return normalizeSingleAnswerResponse(raw);
};

export const fetchPracticeQuestionSet = async (payload: QuestionSetRequest = {}) => {
  const raw = await apiPost<RawQuestionSetResponse>('/api/practice/set', payload);
  return normalizeQuestionSetResponse(raw);
};

export const submitPracticeSetAnswers = async (payload: {
  answers: Array<{ question_id: string; selected_option: ChoiceOption }>;
}) => {
  const raw = await apiPost<RawSetAnswerResponse>('/api/practice/set/answer', payload);
  return normalizeSetAnswerResponse(raw);
};
