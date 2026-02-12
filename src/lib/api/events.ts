import { apiGet, apiPost } from '@/lib/api/client';
import { getActiveUser } from '@/lib/auth/session';
import type { UserEventDTO, UserEventType } from '@/lib/api/types';

export type TrackEventInput = Omit<UserEventDTO, 'eventId' | 'userId' | 'occurredAt'> & {
  userId?: string;
  eventId?: string;
  occurredAt?: string;
};

export interface FetchUserEventsOptions {
  limit?: number;
  eventType?: UserEventType;
  source?: string;
  userId?: string;
  includeAll?: boolean;
}

export const TEACHER_ASSIGNMENT_EVENT_TYPE: UserEventType = 'teacher_assignment';
export const TEACHER_ASSIGNMENT_SOURCE = 'teacher/requirements';
export const TEACHER_ASSIGNMENT_ANSWER_SOURCE = 'student/practice/teacher-assignment';

export type TeacherAssignmentQuestionType = 'single' | 'blank' | 'essay';

export interface TeacherAssignmentMetrics extends Record<string, unknown> {
  assignmentId: string;
  version: number;
  title: string;
  stem: string;
  questionType: TeacherAssignmentQuestionType;
  options: string[];
  blankCount: number;
  referenceAnswer: string;
  note: string;
  senderId: string;
  senderName: string;
  className: string;
  sentAt: string;
}

export interface SendTeacherAssignmentInput {
  targetUserId: string;
  assignmentId: string;
  version: number;
  title: string;
  stem: string;
  questionType: TeacherAssignmentQuestionType;
  options?: string[];
  blankCount?: number;
  referenceAnswer?: string;
  note?: string;
  senderId?: string;
  senderName?: string;
  className?: string;
  sentAt?: string;
}

export interface FetchTeacherAssignmentsOptions {
  limit?: number;
  userId?: string;
  includeAll?: boolean;
}

export interface TeacherAssignmentSingleAnswer {
  questionType: 'single';
  selectedIndex: number;
  selectedLabel: string;
  selectedText: string;
}

export interface TeacherAssignmentBlankAnswer {
  questionType: 'blank';
  answers: string[];
}

export interface TeacherAssignmentEssayAnswer {
  questionType: 'essay';
  answerText: string;
}

export type TeacherAssignmentAnswerPayload =
  | TeacherAssignmentSingleAnswer
  | TeacherAssignmentBlankAnswer
  | TeacherAssignmentEssayAnswer;

export interface SubmitTeacherAssignmentAnswerInput {
  assignmentId: string;
  version: number;
  questionType: TeacherAssignmentQuestionType;
  answer: TeacherAssignmentAnswerPayload;
  title?: string;
  stem?: string;
  senderId?: string;
  senderName?: string;
  userId?: string;
  submittedAt?: string;
}

const createEventId = () => {
  const timePart = Date.now().toString(36);
  const randPart = Math.random().toString(36).slice(2, 8);
  return `ev_${timePart}_${randPart}`;
};

export const logUserEvent = async (input: TrackEventInput) => {
  const userId = input.userId || getActiveUser()?.userId;
  if (!userId) return null;

  const event: UserEventDTO = {
    eventId: input.eventId || createEventId(),
    userId,
    occurredAt: input.occurredAt || new Date().toISOString(),
    eventType: input.eventType,
    source: input.source,
    roundId: input.roundId,
    conversationId: input.conversationId,
    knowledgeNodes: input.knowledgeNodes,
    metrics: input.metrics,
  };

  try {
    await apiPost<{ ok: boolean }>('/api/profile/events', event);
  } catch (error) {
    console.warn('Failed to log user event', error);
  }

  return event;
};

export const fetchUserEvents = (optionsOrLimit: number | FetchUserEventsOptions = 8) => {
  const options = typeof optionsOrLimit === 'number' ? { limit: optionsOrLimit } : optionsOrLimit;
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.eventType) params.set('eventType', options.eventType);
  if (options.source) params.set('source', options.source);
  if (options.userId) params.set('userId', options.userId);
  if (options.includeAll) params.set('includeAll', '1');
  return apiGet<{ events: UserEventDTO[] }>(`/api/profile/events?${params.toString()}`);
};

export const sendTeacherAssignment = async (input: SendTeacherAssignmentInput) => {
  const activeUser = getActiveUser();
  const senderId = input.senderId || activeUser?.userId;
  if (!senderId) {
    throw new Error('缺少 senderId');
  }

  const sentAt = input.sentAt || new Date().toISOString();
  const metrics: TeacherAssignmentMetrics = {
    assignmentId: input.assignmentId.trim(),
    version: input.version,
    title: input.title.trim(),
    stem: input.stem.trim(),
    questionType: input.questionType,
    options: (input.options || []).map((item) => item.trim()).filter(Boolean),
    blankCount: input.blankCount || 0,
    referenceAnswer: (input.referenceAnswer || '').trim(),
    note: (input.note || '').trim(),
    senderId,
    senderName: (input.senderName || activeUser?.name || '教师').trim(),
    className: (input.className || activeUser?.className || '').trim(),
    sentAt,
  };

  const event: UserEventDTO = {
    eventId: createEventId(),
    userId: input.targetUserId.trim(),
    occurredAt: sentAt,
    eventType: TEACHER_ASSIGNMENT_EVENT_TYPE,
    source: TEACHER_ASSIGNMENT_SOURCE,
    roundId: metrics.assignmentId,
    metrics,
  };

  await apiPost<{ ok: boolean }>('/api/profile/events', event);
  return event;
};

export const fetchTeacherAssignments = (options: FetchTeacherAssignmentsOptions = {}) =>
  fetchUserEvents({
    limit: options.limit ?? 200,
    eventType: TEACHER_ASSIGNMENT_EVENT_TYPE,
    source: TEACHER_ASSIGNMENT_SOURCE,
    userId: options.userId,
    includeAll: options.includeAll,
  });

export const submitTeacherAssignmentAnswer = async (input: SubmitTeacherAssignmentAnswerInput) => {
  const activeUser = getActiveUser();
  const userId = input.userId || activeUser?.userId;
  if (!userId) {
    throw new Error('缺少 userId');
  }

  const occurredAt = input.submittedAt || new Date().toISOString();
  const normalizedVersion = Number.isFinite(input.version) ? Math.max(1, Math.floor(input.version)) : 1;
  const event: UserEventDTO = {
    eventId: createEventId(),
    userId,
    occurredAt,
    eventType: 'practice_submit',
    source: TEACHER_ASSIGNMENT_ANSWER_SOURCE,
    roundId: input.assignmentId.trim(),
    metrics: {
      assignmentId: input.assignmentId.trim(),
      version: normalizedVersion,
      questionType: input.questionType,
      title: (input.title || '').trim(),
      stem: (input.stem || '').trim(),
      senderId: (input.senderId || '').trim(),
      senderName: (input.senderName || '').trim(),
      answer: input.answer,
      submittedAt: occurredAt,
      fromTeacherAssignment: true,
    },
  };

  await apiPost<{ ok: boolean }>('/api/profile/events', event);
  return event;
};
