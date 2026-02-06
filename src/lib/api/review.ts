import { apiPost } from '@/lib/api/client';

export interface RunResult {
  success: boolean;
  data?: {
    output: string;
    compileTime: string;
    runTime: string;
    totalTime: string;
    hasInput: boolean;
    exitCode: number;
  };
  errorType?: string;
  errorLines?: number[];
  errorLinesSummary?: string;
  errorSummary?: string;
  error?: string;
  exitCode?: number;
}

export interface ReviewResult {
  status: 'ok' | 'timeout' | 'error';
  summary: string;
  details: string[];
  suggestions: string[];
  questions: string[];
}

export const runCode = (payload: { code: string; input?: string }) =>
  apiPost<RunResult>('/api/run-c', payload);

export const requestReview = (payload: { code: string; mode: 'syntax' | 'style' | 'logic'; runResult: RunResult }) =>
  apiPost<ReviewResult>('/api/review', payload);
