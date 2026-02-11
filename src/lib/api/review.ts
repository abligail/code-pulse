import { apiPost } from '@/lib/api/client';

export type ReviewMode = 'syntax' | 'style' | 'logic';

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

export interface ReviewBranchMetrics {
  issueCount: number;
  highestSeverity: number;
  mode: ReviewMode;
  weakCandidateCount: number;
  syncAdded: number;
  syncUpdated: number;
  syncSkipped: number;
  syncErrors: number;
}

export interface ReviewBranchResponse {
  review: ReviewResult;
  metrics: ReviewBranchMetrics;
}

export const runCode = (payload: { code: string; input?: string }) =>
  apiPost<RunResult>('/api/run-c', payload);

export const requestReview = (payload: { code: string; mode: ReviewMode; runResult: RunResult; roundId?: string }) =>
  apiPost<ReviewBranchResponse>('/api/review', payload);
