'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Plus, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderHeading, PageHeaderMeta, PageHeaderTitle } from '@/components/ui/page-header';
import { ClientIcon } from '@/components/client-icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getActiveUser, setLastQuestion } from '@/lib/auth/session';
import { appendQuizHistoryEntry, type QuizHistoryEntry, type QuizHistoryCheckState } from '@/lib/storage/quiz-history';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  cards?: AssistantCardItem[];
  timestamp: Date;
  streaming?: boolean;
}

interface AssistantCardItem {
  title: string;
  description?: string;
  question?: string;
  relationship?: string;
  source?: string;
}

interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  cards?: AssistantCardItem[];
  timestamp: string;
}

interface ChatSession {
  sessionId: string;
  conversationId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
}

interface WeakKnowledgePoint {
  knowledge_id: string;
  knowledge_name: string;
  knowledge_category: string[];
  weak_reason: string;
  weak_score: number;
  first_weak_time: string;
  last_review_time: string | null;
  review_count: number;
}

interface UserProfileResponse {
  user_id: string;
  user_name: string;
  learning_preference?: Record<string, unknown>;
  weak_knowledge?: WeakKnowledgePoint[];
}

interface WeakQuizQuestion {
  question_type: '选择题' | '填空题' | '简答题' | string;
  question_stem: string;
  options: string[];
  blank_count: number;
  reference_answer: string;
  answer_analysis: string;
}

interface WeakQuizPayload {
  knowledge_id: string;
  knowledge_name: string;
  knowledge_category: string[];
  questions: WeakQuizQuestion[];
}

interface QuizCacheEntry {
  payload: WeakQuizPayload;
  used: boolean;
  updatedAt: string;
}

type QuizCheckState = QuizHistoryCheckState;

const STORAGE_KEY = 'code-pulse/chat-sessions';
const QUIZ_CACHE_KEY = 'code-pulse/weak-quiz-cache';
const EBBINGHAUS_INTERVALS = [0.5, 1, 2, 4, 7, 15, 30];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SESSION_RETENTION_MS = 7 * DAY_IN_MS;

const normalizeUserId = (userId?: string | null) => {
  const trimmed = (userId ?? '').trim();
  return trimmed || 'guest';
};

const getUserScopedStorageKey = (baseKey: string, userId?: string | null) =>
  `${baseKey}/${normalizeUserId(userId)}`;

const getCurrentUserId = () => {
  if (typeof window === 'undefined') return 'guest';
  return normalizeUserId(getActiveUser()?.userId);
};

const readOrMigrateScopedItem = (scopedKey: string, legacyKey: string): string | null => {
  if (typeof window === 'undefined') return null;
  const scopedValue = localStorage.getItem(scopedKey);
  if (scopedValue !== null) return scopedValue;
  if (scopedKey === legacyKey) return scopedValue;
  const legacyValue = localStorage.getItem(legacyKey);
  if (legacyValue === null) return null;
  try {
    localStorage.setItem(scopedKey, legacyValue);
    localStorage.removeItem(legacyKey);
  } catch (error) {
    console.error('Failed to migrate legacy storage value', error);
  }
  return legacyValue;
};

const findWeakScoreRecursively = (value: unknown): number | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = findWeakScoreRecursively(entry);
      if (nested !== null) return nested;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'weak_score') {
        const num = typeof entry === 'number' ? entry : Number(entry);
        if (!Number.isNaN(num)) return num;
      }
      const nested = findWeakScoreRecursively(entry);
      if (nested !== null) return nested;
    }
  }
  return null;
};

const extractWeakScoreFromMessage = (text: string): number | null => {
  if (!text) return null;
  const tryJson = (payload: string): number | null => {
    try {
      const parsed = JSON.parse(payload) as unknown;
      return findWeakScoreRecursively(parsed);
    } catch {
      return null;
    }
  };

  const direct = tryJson(text);
  if (direct !== null) return direct;

  const braceMatch = text.match(/\{[\s\S]*\}/g);
  if (braceMatch) {
    for (const chunk of braceMatch) {
      const nested = tryJson(chunk);
      if (nested !== null) return nested;
    }
  }

  const regex = /weak_score\s*[:：]\s*(-?\d+(?:\.\d+)?)/i;
  const match = text.match(regex);
  if (match) {
    const num = Number(match[1]);
    if (!Number.isNaN(num)) return num;
  }
  return null;
};

const readInitialQuizCache = (userId: string): Record<string, QuizCacheEntry> => {
  if (typeof window === 'undefined') return {};
  try {
    const storageKey = getUserScopedStorageKey(QUIZ_CACHE_KEY, userId);
    const raw = readOrMigrateScopedItem(storageKey, QUIZ_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, QuizCacheEntry>;
      return parsed;
    }
  } catch (error) {
    console.error('Failed to read quiz cache', error);
  }
  return {};
};

const stripOptionLabel = (text: string): string => {
  // Remove leading option labels like "A.", "B、", etc.
  return text.replace(/^[A-Da-dＡ-Ｄａ-ｄ][\.．、:：\s-]+/, '').trim();
};

const splitAnswers = (text: string): string[] => {
  return text
    .split(/[;；、，]/)
    .map((s) => s.trim())
    .filter(Boolean);
};

export default function ChatPage() {
  const initialUserIdRef = useRef<string>(getCurrentUserId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Last question persisted only in storage; no in-memory display needed
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [stickBottom, setStickBottom] = useState(true);
  const [weakPoints, setWeakPoints] = useState<WeakKnowledgePoint[]>([]);
  const [weakLoading, setWeakLoading] = useState(false);
  const [weakError, setWeakError] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizMeta, setQuizMeta] = useState<WeakQuizPayload | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<WeakQuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizChecks, setQuizChecks] = useState<QuizCheckState[]>([]);
  const [quizReview, setQuizReview] = useState('');
  const [quizReviewLoading, setQuizReviewLoading] = useState(false);
  const [quizReviewError, setQuizReviewError] = useState<string | null>(null);
  const [quizCache, setQuizCache] = useState<Record<string, QuizCacheEntry>>(() =>
    readInitialQuizCache(initialUserIdRef.current)
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const quizCacheRef = useRef<Record<string, QuizCacheEntry>>(quizCache);
  const [activeWeakPoint, setActiveWeakPoint] = useState<WeakKnowledgePoint | null>(null);

  const pruneSessions = useCallback((list: ChatSession[]) => {
    const now = Date.now();
    return list.filter((session) => {
      const updatedAt = new Date(session.updatedAt).getTime();
      return Number.isFinite(updatedAt) && now - updatedAt <= SESSION_RETENTION_MS;
    });
  }, [SESSION_RETENTION_MS]);

  // Load history from localStorage on mount
  useEffect(() => {
    const userId = getCurrentUserId();
    const storageKey = getUserScopedStorageKey(STORAGE_KEY, userId);
    void loadWeakPoints(userId);

    try {
      const raw = readOrMigrateScopedItem(storageKey, STORAGE_KEY);
      if (raw) {
        const stored: ChatSession[] = JSON.parse(raw);
        const recent = pruneSessions(stored);
        if (recent.length !== stored.length && typeof window !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(recent));
        }
        const prepared = recent.map((session) => ({
          ...session,
          messages: session.messages.map((m) => ({ ...m, timestamp: m.timestamp })),
        }));
        prepared.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setSessions(prepared);
        if (prepared.length > 0) {
          const latest = prepared[0];
          setCurrentSessionId(latest.sessionId);
          setConversationId(latest.conversationId);
          setMessages(
            latest.messages.map((m) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }))
          );
          return;
        }
      }
    } catch (error) {
      console.error('Failed to load chat history', error);
    }

    const defaultSessionId = Date.now().toString();
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      text: '你好！我是你的学习助理，随时可以向我提问。',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    setCurrentSessionId(defaultSessionId);
    const initialSession: ChatSession = {
      sessionId: defaultSessionId,
      conversationId: null,
      title: '新会话',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [{ ...welcomeMessage, timestamp: welcomeMessage.timestamp.toISOString() }],
    };
    setSessions([initialSession]);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify([initialSession]));
    }
  }, [pruneSessions]);

  // Persist quiz cache
  useEffect(() => {
    quizCacheRef.current = quizCache;
  }, [quizCache]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storageKey = getUserScopedStorageKey(QUIZ_CACHE_KEY, getCurrentUserId());
      localStorage.setItem(storageKey, JSON.stringify(quizCache));
    } catch (error) {
      console.error('Failed to persist quiz cache', error);
    }
  }, [quizCache]);

  // Auto-scroll to bottom when new messages arrive unless user has scrolled up
  useEffect(() => {
    if (!scrollRef.current) return;
    if (stickBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, stickBottom]);

  // Track user scroll intent to avoid forcing back to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setStickBottom(distanceFromBottom < 120);
    };
    el.addEventListener('scroll', handler);
    return () => {
      el.removeEventListener('scroll', handler);
    };
  }, []);

  // Persist current session to localStorage whenever messages or conversationId change
  useEffect(() => {
    if (!currentSessionId) return;
    const storageKey = getUserScopedStorageKey(STORAGE_KEY, getCurrentUserId());
    setSessions((prev) => {
      const nextSessions = [...prev];
      const idx = nextSessions.findIndex((s) => s.sessionId === currentSessionId);
      const nowIso = new Date().toISOString();
      const firstUser = messages.find((m) => m.role === 'user');
      const title = firstUser?.text ? firstUser.text.slice(0, 24) : '新会话';
      const storedMessages = messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        cards: m.cards,
        timestamp: m.timestamp.toISOString(),
      }));
      if (idx >= 0) {
        nextSessions[idx] = {
          ...nextSessions[idx],
          conversationId,
          messages: storedMessages,
          updatedAt: nowIso,
          title,
        };
      } else {
        nextSessions.unshift({
          sessionId: currentSessionId,
          conversationId,
          title,
          createdAt: nowIso,
          updatedAt: nowIso,
          messages: storedMessages,
        });
      }
      const pruned = pruneSessions(nextSessions);
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(pruned));
      }
      return pruned;
    });
  }, [messages, conversationId, currentSessionId, pruneSessions]);

  const formatMessageTime = (date: Date) =>
    date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleWeakPointRemoval = useCallback((knowledgeId: string) => {
    setWeakPoints((prev) => prev.filter((item) => item.knowledge_id !== knowledgeId));
    setQuizCache((prev) => {
      if (!prev[knowledgeId]) return prev;
      const next = { ...prev };
      delete next[knowledgeId];
      return next;
    });
    let shouldCloseQuiz = false;
    setActiveWeakPoint((prev) => {
      if (prev?.knowledge_id === knowledgeId) {
        shouldCloseQuiz = true;
        return null;
      }
      return prev;
    });
    if (shouldCloseQuiz) {
      setQuizOpen(false);
    }
  }, []);

  const deleteWeakKnowledgePoint = useCallback(
    async (userId: string, knowledgeId: string) => {
      try {
        const res = await fetch(
          `/api/mongodb/user_profile/${encodeURIComponent(userId)}/weak/${encodeURIComponent(knowledgeId)}`,
          { method: 'DELETE' }
        );
        if (!res.ok) {
          throw new Error(`Delete weak knowledge failed: ${res.status}`);
        }
        handleWeakPointRemoval(knowledgeId);
      } catch (error) {
        console.error('Failed to delete weak knowledge point', error);
      }
    },
    [handleWeakPointRemoval]
  );

  const computeNextReview = (item: WeakKnowledgePoint) => {
    // Loop through Ebbinghaus intervals; restarting a new cycle once one round completes
    const reviewCount = Math.max(0, item.review_count ?? 0);
    const cycleLength = EBBINGHAUS_INTERVALS.length;
    const cyclePosition = cycleLength > 0 ? reviewCount % cycleLength : 0;
    const baseTimestamp = item.last_review_time || item.first_weak_time;
    const baseDate = baseTimestamp ? new Date(baseTimestamp) : new Date();
    const intervalDays = EBBINGHAUS_INTERVALS[cyclePosition] ?? EBBINGHAUS_INTERVALS[EBBINGHAUS_INTERVALS.length - 1];
    const next = new Date(baseDate.getTime() + intervalDays * DAY_IN_MS);
    const due = Date.now() >= next.getTime();
    return { next, due };
  };

  const parseCardItems = (rawContent: string): AssistantCardItem[] => {
    try {
      const parsed = JSON.parse(rawContent);
      if (parsed?.data) {
        const data = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
        const list = data?.variables?.NQLCJhyvJf?.defaultValue;
        if (Array.isArray(list)) {
          return list
            .map((item: Record<string, unknown>) => ({
              title: String(item.title ?? ''),
              description: item.description ? String(item.description) : undefined,
              question: item.question ? String(item.question) : undefined,
              relationship: item.relationship ? String(item.relationship) : undefined,
              source: item.source ? String(item.source) : undefined,
            }))
            .filter((item) => item.title || item.question || item.description);
        }
      }
      if (parsed?.info_in_card) {
        const lines = String(parsed.info_in_card).split('\n');
        const items: AssistantCardItem[] = [];
        let current: AssistantCardItem = { title: '' };
        for (const line of lines) {
          const [k, ...rest] = line.split(',').map((s) => s.trim());
          const value = rest.join(',');
          if (!k || !value) continue;
          if (k === 'title') {
            if (current.title || current.question || current.description) items.push(current);
            current = { title: value };
          } else if (k === 'question') {
            current.question = value;
          } else if (k === 'description') {
            current.description = value;
          } else if (k === 'relationship') {
            current.relationship = value;
          } else if (k === 'source') {
            current.source = value;
          }
        }
        if (current.title || current.question || current.description) items.push(current);
        return items;
      }
    } catch (error) {
      console.error('Failed to parse card content', error);
    }
    return [];
  };

  const loadWeakPoints = async (userId: string) => {
    setWeakLoading(true);
    setWeakError(null);
    try {
      const url = `/api/user-profile?userId=${encodeURIComponent(userId)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Fetch profile failed: ${res.status}`);
      const rawText = await res.text();
      try {
        const parsed: unknown = JSON.parse(rawText);
        const profileContainer = parsed as UserProfileResponse & { user_profile?: UserProfileResponse };
        const profile: UserProfileResponse | undefined = profileContainer.user_profile ?? profileContainer;
        const weakList = profile?.weak_knowledge ?? [];
        setWeakPoints(Array.isArray(weakList) ? weakList : []);
      } catch {
        console.error('Profile parse failed, response body snippet:', rawText.slice(0, 240));
        throw new Error('Profile response不是有效JSON');
      }
    } catch (error) {
      console.error('Failed to load weak knowledge', error);
      setWeakError('用户画像获取失败');
      setWeakPoints([]);
    } finally {
      setWeakLoading(false);
    }
  };

  const fetchWeakQuizPayload = useCallback(async (point: WeakKnowledgePoint): Promise<WeakQuizPayload | null> => {
    const user = getActiveUser();
    const userId = user?.userId ?? 'guest';
    const workflowInput = {
      user_id: userId,
      knowledge_point: point,
      requested_at: new Date().toISOString(),
    };
    const inputStr = JSON.stringify(workflowInput, null, 2);
    const res = await fetch('https://api.coze.cn/v1/workflow/stream_run', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer pat_xNxZkXWRfLm3CJKLtAd9infadFtKKbzcpqn7YdsmvfZmq1pZYoJbLLvc58WAhyTr',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: '7604323814663634954',
        parameters: {
          input: inputStr,
        },
      }),
    });

    if (!res.body) throw new Error('Empty response');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let payload: WeakQuizPayload | null = null;
    let fallbackText = '';

    const asRecord = (value: unknown): Record<string, unknown> | null =>
      value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

    const normalizePayload = (obj: Record<string, unknown> | null): WeakQuizPayload | null => {
      if (!obj) return null;
      const questions = obj.questions;
      if (Array.isArray(questions)) {
        return {
          knowledge_id: String(obj.knowledge_id ?? ''),
          knowledge_name: String(obj.knowledge_name ?? ''),
          knowledge_category: Array.isArray(obj.knowledge_category) ? (obj.knowledge_category as string[]) : [],
          questions: questions as WeakQuizQuestion[],
        };
      }
      const output = asRecord(obj.output);
      if (output && Array.isArray(output.questions)) {
        return {
          knowledge_id: String(output.knowledge_id ?? obj.knowledge_id ?? ''),
          knowledge_name: String(output.knowledge_name ?? obj.knowledge_name ?? ''),
          knowledge_category: Array.isArray(output.knowledge_category)
            ? (output.knowledge_category as string[])
            : Array.isArray(obj.knowledge_category)
              ? (obj.knowledge_category as string[])
              : [],
          questions: output.questions as WeakQuizQuestion[],
        };
      }
      return null;
    };

    const tryApplyPayload = (text: string) => {
      if (!text) return null;
      // Try direct parse
      try {
        const parsedDirect = JSON.parse(text) as unknown;
        const directObj = asRecord(parsedDirect);
        const normalized = normalizePayload(directObj);
        if (normalized) return normalized;
      } catch {
        // ignore
      }
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        const parsed = JSON.parse(match[0]) as unknown;
        const parsedObj = asRecord(parsed);
        return normalizePayload(parsedObj);
      } catch (err) {
        console.error('Quiz parse failed chunk', err, match[0]?.slice(0, 160));
      }
      return null;
    };

    const handleDataContent = (content: string) => {
      fallbackText += `${content}\n`;
      try {
        const parsed = JSON.parse(content) as unknown;
        const parsedObj = asRecord(parsed);
        const normalized = normalizePayload(parsedObj);
        if (normalized) return normalized;

        const innerRaw = parsedObj?.data ?? parsedObj?.output ?? parsedObj?.result ?? parsedObj?.content ?? null;
        const innerStr = typeof innerRaw === 'string' ? innerRaw : null;
        if (innerStr) {
          const innerNormalized = tryApplyPayload(innerStr);
          if (innerNormalized) return innerNormalized;
          try {
            const innerParsed = JSON.parse(innerStr) as unknown;
            const innerObj = asRecord(innerParsed);
            const fromInner = normalizePayload(innerObj);
            if (fromInner) return fromInner;
            const innerDeep = asRecord(innerObj?.output ?? innerObj?.data ?? null);
            const fromDeep = normalizePayload(innerDeep);
            if (fromDeep) return fromDeep;
          } catch {
            const maybe = tryApplyPayload(innerStr);
            if (maybe) return maybe;
          }
        }
      } catch {
        const maybe = tryApplyPayload(content);
        if (maybe) return maybe;
      }
      return null;
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('data:')) {
          const content = trimmed.slice(5).trim();
          const maybePayload = handleDataContent(content);
          if (maybePayload) {
            payload = maybePayload;
          }
        }
      }
      if (payload) break;
    }

    if (!payload) {
      payload = tryApplyPayload(buffer) || tryApplyPayload(fallbackText);
    }

    return payload;
  }, []);

  const ensureQuizCacheForPoint = useCallback(
    async (point: WeakKnowledgePoint, options?: { forceRefresh?: boolean }) => {
      const existing = quizCacheRef.current[point.knowledge_id];
      if (existing && !existing.used && !options?.forceRefresh) {
        return existing.payload;
      }

      const payload = await fetchWeakQuizPayload(point);
      if (!payload || !Array.isArray(payload.questions)) return null;
      setQuizCache((prev) => ({
        ...prev,
        [point.knowledge_id]: {
          payload,
          used: false,
          updatedAt: new Date().toISOString(),
        },
      }));
      return payload;
    },
    [fetchWeakQuizPayload]
  );

  useEffect(() => {
    if (weakPoints.length === 0) return;
    const prefetch = async () => {
      for (const point of weakPoints) {
        try {
          await ensureQuizCacheForPoint(point);
        } catch (error) {
          console.error('Prefetch weak quiz failed', error);
        }
      }
    };
    void prefetch();
  }, [weakPoints, ensureQuizCacheForPoint]);

  const fetchWeakQuiz = async (point: WeakKnowledgePoint) => {
    setQuizLoading(true);
    setQuizError(null);
    setQuizSubmitted(false);
    setQuizQuestions([]);
    setQuizAnswers([]);
    try {
      const payload = await ensureQuizCacheForPoint(point, { forceRefresh: true });

      if (!payload || !Array.isArray(payload.questions)) {
        throw new Error('Invalid quiz payload');
      }

      setQuizMeta(payload);
      setQuizQuestions(payload.questions);
      setQuizAnswers(payload.questions.map(() => ''));
      setQuizChecks(payload.questions.map(() => 'skip'));
      setQuizReview('');
      setQuizReviewError(null);
    } catch (error) {
      console.error('Failed to fetch quiz', error);
      setQuizError('题目生成失败，请稍后再试');
    } finally {
      setQuizLoading(false);
    }
  };

  const recordQuizHistory = useCallback(
    (reviewText: string, checks: QuizCheckState[]) => {
      if (!quizMeta || !reviewText.trim() || quizQuestions.length === 0) return;
      const now = Date.now();
      const timestamp = new Date(now).toISOString();
      const rawId = (quizMeta.knowledge_id || activeWeakPoint?.knowledge_id || '').trim();
      const knowledgeId = rawId || `quiz-${now}`;
      const knowledgeName = quizMeta.knowledge_name || activeWeakPoint?.knowledge_name || '未命名知识点';
      const categorySource = quizMeta.knowledge_category?.length ? quizMeta.knowledge_category : activeWeakPoint?.knowledge_category;
      const knowledgeCategory = Array.isArray(categorySource)
        ? categorySource.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
      const entry: QuizHistoryEntry = {
        id: `${knowledgeId}-${now}`,
        knowledgeId,
        knowledgeName,
        knowledgeCategory,
        occurredAt: timestamp,
        review: reviewText,
        questions: quizQuestions.map((question, idx) => ({
          stem: question.question_stem,
          type: question.question_type,
          options: question.options ?? [],
          userAnswer: quizAnswers[idx] ?? '',
          referenceAnswer: question.reference_answer || undefined,
          analysis: question.answer_analysis || undefined,
          checkResult: checks[idx] ?? 'skip',
        })),
      };
      appendQuizHistoryEntry(entry, { userId: getCurrentUserId() });
    },
    [quizMeta, quizQuestions, quizAnswers, activeWeakPoint]
  );

  const submitQuizReview = useCallback(
    async (checks: QuizCheckState[]) => {
      if (!quizMeta || quizQuestions.length === 0) return;
      const user = getActiveUser();
      const userId = user?.userId ?? 'guest';
      setQuizReviewLoading(true);
      setQuizReviewError(null);
      setQuizReview('');

      const questionsWithAnswers = quizQuestions.map((q, idx) => ({
        ...q,
        user_answer: quizAnswers[idx] || '',
      }));

      const userReply = questionsWithAnswers
        .map((q, idx) => {
          const prefix = `Q${idx + 1}`;
          return `${prefix}（${q.question_type}）：${q.user_answer || '未作答'}`;
        })
        .join('；');

      const inputStr = `【题目信息】：${JSON.stringify(
        {
          knowledge_id: quizMeta.knowledge_id,
          knowledge_name: quizMeta.knowledge_name,
          knowledge_category: quizMeta.knowledge_category ?? [],
          questions: questionsWithAnswers,
          check_results: checks,
        },
        null,
        2
      )}
【用户回复】：${userReply}`;

      try {
        const res = await fetch('https://api.coze.cn/v1/workflow/stream_run', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer pat_xNxZkXWRfLm3CJKLtAd9infadFtKKbzcpqn7YdsmvfZmq1pZYoJbLLvc58WAhyTr',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workflow_id: '7605245156946788378',
            parameters: {
              input: inputStr,
              uuid: userId,
            },
          }),
        });

        if (!res.body) throw new Error('Empty response');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let reviewText = '';

        const tryParse = (text: string): string | null => {
          if (!text) return null;
          try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            if (typeof parsed.output === 'string') return parsed.output;
            if (typeof parsed.content === 'string') {
              try {
                const inner = JSON.parse(parsed.content) as Record<string, unknown>;
                if (typeof inner.output === 'string') return inner.output;
              } catch {
                /* ignore inner parse */
              }
            }
          } catch {
            /* noop */
          }
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              const parsed = JSON.parse(match[0]) as Record<string, unknown>;
              if (typeof parsed.output === 'string') return parsed.output;
              if (typeof parsed.content === 'string') {
                try {
                  const inner = JSON.parse(parsed.content) as Record<string, unknown>;
                  if (typeof inner.output === 'string') return inner.output;
                } catch {
                  return null;
                }
              }
            } catch {
              return null;
            }
          }
          return null;
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('data:')) {
              const content = trimmed.slice(5).trim();
              const parsed = tryParse(content);
              if (parsed) reviewText = parsed;
            }
          }
          if (reviewText) break;
        }

        if (!reviewText) {
          reviewText = tryParse(buffer) || buffer.trim();
        }

        setQuizReview(reviewText);
        recordQuizHistory(reviewText, checks);

        const weakScoreFromReview = extractWeakScoreFromMessage(reviewText);
        if (weakScoreFromReview !== null && weakScoreFromReview <= 0 && quizMeta.knowledge_id) {
          await deleteWeakKnowledgePoint(userId, quizMeta.knowledge_id);
        }
      } catch (error) {
        console.error('Quiz review failed', error);
        setQuizReviewError('解析获取失败，请稍后重试');
      } finally {
        setQuizReviewLoading(false);
      }
    },
    [quizMeta, quizQuestions, quizAnswers, deleteWeakKnowledgePoint, recordQuizHistory]
  );

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const user = getActiveUser();
    const userId = user?.userId ?? 'guest';
    const roundId = Date.now().toString();
    const userMessage: ChatMessage = {
      id: `${roundId}-u`,
      role: 'user',
      text: message,
      timestamp: new Date(),
    };
    if (!currentSessionId) {
      setCurrentSessionId(roundId);
    }
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const baseUrl = 'https://api.coze.cn/v3/chat';
    const url = conversationId ? `${baseUrl}?conversation_id=${conversationId}` : baseUrl;
    const payload = {
      bot_id: '7555046738315214894',
      user_id: userId,
      stream: true,
      additional_messages: [
        {
          content: '（uuid为' + userId + '）' + message,
          content_type: 'text',
          role: 'user',
          type: 'question',
        },
      ],
    };

    const assistantId = `${roundId}-a`;
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', text: '', cards: [], timestamp: new Date(), streaming: true }]);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer pat_xNxZkXWRfLm3CJKLtAd9infadFtKKbzcpqn7YdsmvfZmq1pZYoJbLLvc58WAhyTr',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.body) {
        throw new Error('Empty response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answerText = '';
      let cardItems: AssistantCardItem[] = [];
      let latestConversationId = conversationId;

      const processDataLine = (raw: string) => {
        const jsonStr = raw.trim();
        if (!jsonStr || jsonStr === '[DONE]') return;
        const data = JSON.parse(jsonStr);
        if (data.conversation_id && !latestConversationId) {
          latestConversationId = String(data.conversation_id);
          setConversationId(latestConversationId);
        }
        if (data.role === 'assistant' && data.type === 'answer') {
          if (data.content_type === 'text') {
            const contentStr = String(data.content ?? '');
            if (answerText && contentStr.startsWith(answerText)) {
              answerText = contentStr; // replace to avoid duplication when API sends full text each chunk
            } else if (contentStr.startsWith(answerText)) {
              answerText = contentStr;
            } else {
              answerText += contentStr;
            }
          } else if (data.content_type === 'card' && typeof data.content === 'string') {
            cardItems = [...cardItems, ...parseCardItems(data.content)];
          }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, text: answerText, cards: cardItems, streaming: true }
                : msg
            )
          );
        }
      };

      // Stream reader updates the assistant message as chunks arrive.
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('data:')) {
            const content = trimmed.slice(5).trim();
            try {
              processDataLine(content);
            } catch (error) {
              console.error('Failed to parse data line', error, content);
            }
          } else if (trimmed.startsWith('event:')) {
            // Ignore event names like conversation.message, ping, done.
            continue;
          } else if (trimmed.startsWith('id:') || trimmed.startsWith('retry:')) {
            continue;
          } else {
            // Fallback: attempt to parse raw line as JSON
            try {
              processDataLine(trimmed);
            } catch (error) {
              console.error('Failed to parse chunk', error, trimmed);
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId ? { ...msg, streaming: false } : msg
        )
      );

      const nextLastQuestion = {
        id: roundId,
        title: message,
        askedAt: new Date().toISOString(),
      };
      setLastQuestion(user?.userId, nextLastQuestion);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, text: '抱歉，发送过程中出现问题，请稍后重试。' }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const handleFollowUp = (followUp: string) => {
    handleSendMessage(followUp);
  };

  const startNewChat = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const sessionId = Date.now().toString();
    const welcome: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      text: '你好！我是你的学习助理，随时可以向我提问。',
      timestamp: new Date(),
    };
    setMessages([welcome]);
    setConversationId(null);
    setCurrentSessionId(sessionId);
    setSessions((prev) => {
      const next: ChatSession[] = [
        {
          sessionId,
          conversationId: null,
          title: '新会话',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [{ ...welcome, timestamp: welcome.timestamp.toISOString() }],
        },
        ...prev,
      ];
      if (typeof window !== 'undefined') {
        const storageKey = getUserScopedStorageKey(STORAGE_KEY, getCurrentUserId());
        localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return next;
    });
  };

  const openQuizForWeakPoint = (point: WeakKnowledgePoint) => {
    setQuizOpen(true);
    setQuizError(null);
    setQuizSubmitted(false);
    setQuizChecks([]);
    setQuizReview('');
    setQuizReviewError(null);
    setQuizReviewLoading(false);
    setActiveWeakPoint(point);
    const cached = quizCache[point.knowledge_id];
    if (cached && !cached.used && cached.payload) {
      setQuizMeta(cached.payload);
      setQuizQuestions(cached.payload.questions);
      setQuizAnswers(cached.payload.questions.map(() => ''));
      setQuizChecks(cached.payload.questions.map(() => 'skip'));
      setQuizLoading(false);
      return;
    }
    setQuizMeta({
      knowledge_id: point.knowledge_id,
      knowledge_name: point.knowledge_name,
      knowledge_category: point.knowledge_category ?? [],
      questions: [],
    });
    void fetchWeakQuiz(point);
  };

  const updateQuizAnswer = (idx: number, value: string) => {
    setQuizAnswers((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleSubmitQuiz = () => {
    setQuizSubmitted(true);
    const checks = quizQuestions.map<QuizCheckState>((q, idx) => {
      const ans = (quizAnswers[idx] || '').trim();
      if (q.question_type.includes('简')) return 'skip';
      if (q.question_type.includes('选')) {
        const ref = (q.reference_answer || '').trim();
        if (!ref) return 'wrong';
        const refLetter = (ref[0] || '').toUpperCase();
        return ans.toUpperCase() === refLetter.toUpperCase() ? 'correct' : 'wrong';
      }
      if (q.question_type.includes('填')) {
        const refParts = splitAnswers(q.reference_answer || '');
        const userParts = splitAnswers(ans);
        if (refParts.length === 0 || userParts.length === 0) return 'wrong';
        if (refParts.length !== userParts.length) return 'wrong';
        const allMatch = refParts.every((part, i) => part === (userParts[i] || ''));
        return allMatch ? 'correct' : 'wrong';
      }
      return 'skip';
    });

    setQuizChecks(checks);

    if (quizMeta?.knowledge_id) {
      setQuizCache((prev) => {
        const existing = prev[quizMeta.knowledge_id];
        if (!existing) return prev;
        return {
          ...prev,
          [quizMeta.knowledge_id]: {
            ...existing,
            used: true,
            updatedAt: new Date().toISOString(),
          },
        };
      });
      if (activeWeakPoint) {
        void ensureQuizCacheForPoint(activeWeakPoint, { forceRefresh: true });
      }
    }

    void submitQuizReview(checks);
  };

  return (
    <>
    <TooltipProvider delayDuration={120} skipDelayDuration={120}>
    <div className="relative flex h-full min-h-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_2%,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(14,116,144,0.15),transparent_32%)]" />

        <div className="relative flex min-h-0 min-w-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background/42">
            <div className="border-b border-border/65 bg-card/72 px-5 py-4 backdrop-blur-sm lg:px-6">
              <PageHeader>
                <PageHeaderHeading>
                  <PageHeaderTitle>知识问答</PageHeaderTitle>
                  <PageHeaderDescription>通过对话引导，梳理概念并生成本轮思考题</PageHeaderDescription>
                </PageHeaderHeading>
                <PageHeaderActions>
                  <Button variant="outline" size="sm" onClick={startNewChat}>
                    <ClientIcon icon={Plus} className="mr-2 h-4 w-4" />
                    新建会话
                  </Button>
                  {sessions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          历史会话
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        {sessions.map((session) => (
                          <DropdownMenuItem
                            key={session.sessionId}
                            className="flex flex-col items-start"
                            onClick={() => {
                              setCurrentSessionId(session.sessionId);
                              setConversationId(session.conversationId);
                              setMessages(
                                session.messages.map((m) => ({
                                  ...m,
                                  timestamp: new Date(m.timestamp),
                                }))
                              );
                            }}
                          >
                            <span className="text-sm font-medium">{session.title || '会话'}</span>
                            <span className="text-xs text-muted-foreground">{new Date(session.updatedAt).toLocaleString()}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <PageHeaderMeta>
                    <span className="rounded-full border border-border/70 bg-muted/65 px-2.5 py-1 text-[11px]">
                      当前会话
                    </span>
                  </PageHeaderMeta>
                </PageHeaderActions>
              </PageHeader>
            </div>

            <ScrollArea className="relative min-h-0 flex-1 px-5 py-6 lg:px-6" viewportRef={scrollRef}>
              <div className="mx-auto max-w-3xl space-y-5 pb-10">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`motion-fade-up flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                  >
                    <div className="max-w-[84%]">
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm shadow-[0_20px_30px_-22px_rgba(15,23,42,0.72)] ${
                          message.role === 'user'
                            ? 'rounded-br-md bg-[linear-gradient(135deg,rgb(37_99_235),rgb(14_116_144))] text-primary-foreground'
                            : 'rounded-bl-md border border-border/70 bg-card/92 text-foreground'
                        }`}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className="prose prose-sm max-w-none text-foreground prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-foreground"
                        >
                          {message.text || (message.streaming ? '...' : '')}
                        </ReactMarkdown>
                        {message.streaming && (
                          <div className="mt-2 text-xs text-muted-foreground">生成中...</div>
                        )}
                      </div>
                      {message.cards && message.cards.length > 0 && !message.streaming && (
                        <div className="mt-3">
                          <KnowledgeGraph items={message.cards} onFollowUp={handleFollowUp} />
                        </div>
                      )}
                      <p
                        className={`mt-1 px-1 text-[11px] text-muted-foreground ${
                          message.role === 'user' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {formatMessageTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="motion-fade-up flex justify-start">
                    <div className="rounded-2xl border border-border/70 bg-card/92 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">思考中...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-border/65 bg-background/86 px-4 py-4 backdrop-blur-md">
              <div className="mx-auto flex max-w-3xl gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    (e.preventDefault(), handleSendMessage(inputValue))
                  }
                  placeholder="输入你的问题..."
                  disabled={isLoading}
                  className="flex-1 border-border/75 bg-card/84"
                />
                <Button onClick={() => handleSendMessage(inputValue)} disabled={isLoading || !inputValue.trim()}>
                  <ClientIcon icon={Send} className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">提示式学习 · 不直接给答案</p>
            </div>
          </div>
          <aside className="hidden xl:block w-80 border-l border-border/50 bg-background/70 backdrop-blur-md">
            <div className="sticky top-0 flex max-h-screen flex-col gap-3 overflow-y-auto px-4 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">学习提醒</p>
                  <h3 className="text-lg font-semibold">薄弱知识点</h3>
                </div>
                {weakLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {weakError && (
                <p className="text-xs text-destructive">{weakError}</p>
              )}
              {!weakLoading && !weakError && weakPoints.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无薄弱知识点。</p>
              )}
              {!weakLoading && weakPoints.length > 0 && (
                <div className="space-y-3">
                  {weakPoints.map((item) => {
                    const { next, due } = computeNextReview(item);
                    const accent = due ? 'from-amber-400/70 to-red-500/60 border-amber-400/50 shadow-[0_12px_30px_-18px_rgba(255,107,1,0.7)]' : 'from-sky-500/35 to-emerald-500/35 border-border/60';
                    return (
                      <Card
                        key={item.knowledge_id}
                        className={`group border ${accent.includes('amber') ? 'animate-pulse-slow' : ''} border-border/70 bg-gradient-to-br ${accent} cursor-pointer transition hover:translate-y-[-2px] hover:border-sky-300/70`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openQuizForWeakPoint(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openQuizForWeakPoint(item);
                          }
                        }}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center justify-between gap-2">
                            <span>{item.knowledge_name}</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${due ? 'bg-amber-500/20 text-amber-100 border border-amber-300/60' : 'bg-emerald-500/15 text-emerald-50 border border-emerald-400/40'}`}>
                              {due ? '待复习' : '已安排'}
                            </span>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {item.knowledge_category?.join(' · ') || '知识点'} · 记忆衰减分：{item.weak_score}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs text-foreground/90">
                          <p className="leading-relaxed text-muted-foreground">{item.weak_reason}</p>
                          <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">下次复习</span>
                              <span className="font-medium">{next.toLocaleString()}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-muted-foreground">
                              <span>已复习</span>
                              <span>{item.review_count ?? 0} 次</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
      </TooltipProvider>

      <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span>薄弱点练习</span>
              {quizMeta?.knowledge_name && (
                <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                  {quizMeta.knowledge_name}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              根据薄弱点生成的小练习，提交后会记录你的作答（当前仅本地显示）。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 max-h-[70vh] grid-cols-1 md:grid-cols-[2.7fr_2.4fr]">
            <div className="space-y-4 overflow-y-auto pr-2 md:pr-5">
              {quizLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>题目生成中...</span>
                </div>
              )}

              {quizError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {quizError}
                </div>
              )}

              {!quizLoading && !quizError && quizQuestions.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无题目，请稍后重试。</p>
              )}

              {quizQuestions.map((q, idx) => {
                const answer = quizAnswers[idx] ?? '';
                const isChoice = q.question_type.includes('选');
                const isBlank = q.question_type.includes('填');
                const isEssay = q.question_type.includes('简');
                const checkState = quizChecks[idx];
                const badgeColor = checkState === 'correct' ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/60' : checkState === 'wrong' ? 'bg-red-500/15 text-red-200 border-red-400/60' : 'bg-muted/60 text-muted-foreground border-border/60';
                const badgeText = checkState === 'correct' ? '正确' : checkState === 'wrong' ? '错误' : '待判定';
                return (
                  <div key={`quiz-${idx}`} className={`rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm ${checkState === 'correct' ? 'ring-1 ring-emerald-400/60' : checkState === 'wrong' ? 'ring-1 ring-red-400/60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5">
                            {q.question_type || '题目'}
                          </span>
                          {quizMeta?.knowledge_category?.length ? (
                            <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5">
                              {quizMeta.knowledge_category.join(' / ')}
                            </span>
                          ) : null}
                          <span className={`rounded-full border px-2 py-0.5 ${badgeColor}`}>{badgeText}</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed text-foreground">{q.question_stem}</p>
                      </div>
                      {quizSubmitted && !isEssay && (q.reference_answer || q.answer_analysis) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 text-xs" aria-label="查看解析">
                              解析
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs space-y-2 text-xs leading-relaxed">
                            {q.reference_answer && <p className="font-semibold">参考答案：{q.reference_answer}</p>}
                            {q.answer_analysis && <p className="text-muted-foreground">{q.answer_analysis}</p>}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      {isChoice && q.options?.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {q.options.map((opt, optIdx) => {
                            const display = stripOptionLabel(opt);
                            const value = String.fromCharCode(65 + optIdx);
                            const checked = answer === value;
                            return (
                              <label
                                key={`opt-${idx}-${optIdx}`}
                                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                                  checked ? 'border-sky-400/70 bg-sky-500/10' : 'border-border/60 hover:border-sky-300/70'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`quiz-${idx}`}
                                  className="mt-1"
                                  value={value}
                                  checked={checked}
                                  onChange={() => updateQuizAnswer(idx, value)}
                                />
                                <span className="leading-relaxed">
                                  <span className="mr-2 font-semibold text-xs text-muted-foreground">{value}</span>
                                  {display}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {isBlank && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">{`填空数量：${q.blank_count || 1}`}</p>
                          <Input
                            value={answer}
                            onChange={(e) => updateQuizAnswer(idx, e.target.value)}
                            placeholder="请输入答案（多个用；分隔）"
                            className="bg-background/80"
                          />
                        </div>
                      )}

                      {isEssay && (
                        <Textarea
                          value={answer}
                          onChange={(e) => updateQuizAnswer(idx, e.target.value)}
                          placeholder="请输入你的作答"
                          className="min-h-[120px] bg-background/80"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="overflow-y-auto rounded-xl border border-border/60 bg-card/80 p-6 shadow-sm md:pl-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">答案解析</h4>
                {quizReviewLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {quizReviewError && (
                <p className="mt-2 text-sm text-destructive">{quizReviewError}</p>
              )}
              {!quizReview && !quizReviewLoading && !quizReviewError && (
                <p className="mt-2 text-sm text-muted-foreground">提交后展示参考答案、评价与改进建议。</p>
              )}
              {quizReview && (
                <div className="mt-3 space-y-2 text-sm leading-relaxed text-foreground">
                  {quizReview.split(/\n+/).map((line, idx) => (
                    <p key={`review-${idx}`}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {quizSubmitted ? '已提交（当前仅本地记录，后续将用于评估）。' : '完成所有题目后提交，本地记录你的作答。'}
            </div>
            <Button onClick={handleSubmitQuiz} disabled={quizLoading || quizQuestions.length === 0 || quizSubmitted || quizReviewLoading}>
              {quizSubmitted ? '已提交' : '提交作答'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
    );
}

function KnowledgeGraph({ items, onFollowUp }: { items: AssistantCardItem[]; onFollowUp: (question: string) => void }) {
  const graph = useMemo(() => {
    const grouped = new Map<string, AssistantCardItem[]>();
    (items || []).forEach((item) => {
      const key = item.source?.trim() || '知识点';
      grouped.set(key, [...(grouped.get(key) || []), item]);
    });

    const phyllotaxisPosition = (index: number, total: number) => {
      if (total <= 1) {
        return { cx: 50, cy: 50 };
      }
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const radiusScale = 34;
      const normalizedIndex = (index + 0.5) / total;
      const radius = 8 + radiusScale * Math.sqrt(normalizedIndex);
      const angle = index * goldenAngle;
      const cx = 50 + radius * Math.cos(angle);
      const cy = 50 + radius * Math.sin(angle);
      const clamp = (value: number) => Math.min(88, Math.max(12, value));
      return { cx: clamp(cx), cy: clamp(cy) };
    };

    const centers = Array.from(grouped.entries()).map(([label, groupItems], idx, arr) => {
      const { cx, cy } = phyllotaxisPosition(idx, Math.max(arr.length, 1));
      const nodeRingBase = 14 + Math.max(0, 10 - groupItems.length);
      const nodes = groupItems.map((item, nodeIdx) => {
        const offset = (2 * Math.PI * nodeIdx) / Math.max(groupItems.length, 1);
        const nodeAngle = offset + nodeIdx * 0.07;
        const ring = nodeRingBase + (nodeIdx % 2) * 3;
        return {
          ...item,
          cx,
          cy,
          angle: nodeAngle,
          x: cx + ring * Math.cos(nodeAngle),
          y: cy + ring * Math.sin(nodeAngle),
        };
      });

      return { label, cx, cy, nodes };
    });

    const edges = centers.flatMap((center) =>
      center.nodes.map((node) => {
        const midX = (center.cx + node.x) / 2;
        const midY = (center.cy + node.y) / 2;
        const angleDeg = (node.angle * 180) / Math.PI;
        const readableAngle = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;
        return {
          fromX: center.cx,
          fromY: center.cy,
          toX: node.x,
          toY: node.y,
          midX,
          midY,
          readableAngle,
          relationship: node.relationship,
        };
      })
    );

    return { centers, edges };
  }, [items]);

  if (!graph.centers.length) return null;

  return (
    <div className="mx-auto w-full max-w-[520px] rounded-2xl border border-border/60 bg-gradient-to-br from-sky-950/35 via-slate-900/50 to-emerald-900/35 p-4 text-foreground shadow-[0_20px_40px_-30px_rgba(0,0,0,0.7)]">
      <div className="relative aspect-square w-full min-h-[260px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {graph.edges.map((edge, idx) => (
            <g key={`edge-${idx}`} className="text-xs" opacity={0.9}>
              <line
                x1={edge.fromX}
                y1={edge.fromY}
                x2={edge.toX}
                y2={edge.toY}
                stroke="url(#edgeGradient)"
                strokeWidth={1.5}
                strokeOpacity={0.85}
                strokeLinecap="round"
              />
              {edge.relationship && (
                <text
                  x={edge.midX}
                  y={edge.midY}
                  fill="hsl(var(--muted-foreground))"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="1.6"
                  transform={`rotate(${edge.readableAngle}, ${edge.midX}, ${edge.midY})`}
                >
                  {edge.relationship}
                </text>
              )}
            </g>
          ))}

          <defs>
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(59,130,246,0.82)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.74)" />
            </linearGradient>
          </defs>
        </svg>

        {graph.centers.map((center, idx) => (
          <div
            key={`center-${idx}`}
            className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-sky-300/65 bg-gradient-to-br from-slate-800/85 to-slate-900/90 text-center text-[10px] font-semibold text-white/80 shadow-lg"
            style={{ left: `${center.cx}%`, top: `${center.cy}%` }}
          >
            <span className="px-2 leading-snug">{center.label}</span>
          </div>
        ))}

        {graph.centers.flatMap((center, centerIdx) =>
          center.nodes.map((node, idx) => (
            <Tooltip key={`node-${centerIdx}-${idx}`}>
              <TooltipTrigger asChild>
                <button
                  className="absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/82 text-center text-[10px] font-medium text-foreground shadow-md transition hover:scale-105 hover:border-sky-300/70 hover:bg-background/95"
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                >
                  <span className="px-2 leading-tight">{node.title || '知识点'}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs space-y-2 border-border/70 bg-card/95 text-foreground">
                <div className="text-sm font-semibold">{node.title || '知识点'}</div>
                {node.description && <p className="text-xs text-muted-foreground leading-relaxed">{node.description}</p>}
                {node.question && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      const q = node.question;
                      if (q) onFollowUp(q);
                    }}
                  >
                    {node.question}
                  </Button>
                )}
              </TooltipContent>
            </Tooltip>
          ))
        )}
      </div>
    </div>
  );
}