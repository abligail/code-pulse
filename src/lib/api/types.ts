export type MasteryLevel = 1 | 2 | 3 | 4 | 5;

export interface UserProfileDTO {
  userId: string;
  mastery: Array<{ nodeId: string; name: string; nodeType: string; level: MasteryLevel; lastSeenAt: string }>;
  reviewQueue: Array<{ nodeId: string; name: string; dueAt: string; reason: 'ebbinghaus' | 'weak' | 'teacher' }>;
  lastQuestion?: { id: string; title: string; askedAt: string };
}

export interface ChatRoundSummaryDTO {
  roundId: string;
  questionCard: { title: string; prompt: string; hints: string[] };
}

export interface QuickQuizDTO {
  quizId: string;
  question: string;
  options?: string[];
  answerType: 'single' | 'text';
}

export interface TeacherRequirementDTO {
  classId: string;
  className?: string;
  updatedAt?: string;
  nodes: Array<{
    nodeId: string;
    nodeName?: string;
    nodeType?: string;
    targetMastery: MasteryLevel;
    minChatRounds?: number;
    minPracticeCount?: number;
    priority?: 1 | 2 | 3 | 4 | 5;
    deadlineAt?: string;
    tags?: string[];
    note?: string;
    groupName?: string;
  }>;
}

export interface QuestionClusterDTO {
  clusterId: string;
  label: string;
  topKeywords: string[];
  count: number;
}

export type UserEventType =
  | 'chat_round'
  | 'practice_submit'
  | 'review_run'
  | 'quiz_submit'
  | 'knowledge_card_open'
  | 'teacher_assignment';

export interface UserEventDTO {
  eventId: string;
  userId: string;
  occurredAt: string;
  eventType: UserEventType;
  source: string;
  roundId?: string;
  conversationId?: string;
  knowledgeNodes?: Array<{ nodeId: string; nodeName?: string }>;
  metrics?: Record<string, unknown>;
}
