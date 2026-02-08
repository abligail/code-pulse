'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Plus, Loader2, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderHeading, PageHeaderMeta, PageHeaderTitle } from '@/components/ui/page-header';
import { ClientIcon } from '@/components/client-icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getActiveUser, getLastQuestion, setLastQuestion, type LastQuestion } from '@/lib/auth/session';

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

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastQuestion, setLastQuestionState] = useState<LastQuestion | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [stickBottom, setStickBottom] = useState(true);
  const [weakPoints, setWeakPoints] = useState<WeakKnowledgePoint[]>([]);
  const [weakLoading, setWeakLoading] = useState(false);
  const [weakError, setWeakError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const STORAGE_KEY = 'code-pulse/chat-sessions';

  // Load history from localStorage on mount
  useEffect(() => {
    const user = getActiveUser();
    setLastQuestionState(getLastQuestion(user?.userId));
    void loadWeakPoints(user?.userId ?? 'guest');

    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const stored: ChatSession[] = JSON.parse(raw);
        const prepared = stored.map((session) => ({
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify([initialSession]));
    }
  }, []);

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
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSessions));
      }
      return nextSessions;
    });
  }, [messages, conversationId, currentSessionId]);

  const formatMessageTime = (date: Date) =>
    date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const computeNextReview = (item: WeakKnowledgePoint) => {
    // Simple spaced intervals in days based on Ebbinghaus-style spacing
    const intervals = [0.5, 1, 2, 4, 7, 15, 30];
    const idx = Math.min(item.review_count ?? 0, intervals.length - 1);
    const base = item.last_review_time || item.first_weak_time;
    const baseDate = new Date(base);
    const next = new Date(baseDate.getTime() + intervals[idx] * 24 * 60 * 60 * 1000);
    const due = new Date() >= next;
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
      setLastQuestionState(nextLastQuestion);
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleReviewLast = () => {
    if (!lastQuestion) return;
    handleSendMessage(lastQuestion.title);
  };

  return (
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
                {lastQuestion && (
                  <Card className="motion-fade-up border-dashed border-border/75 bg-muted/35 py-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <ClientIcon icon={RotateCcw} className="h-4 w-4" />
                        上次问题回顾
                      </CardTitle>
                      <CardDescription>
                        上次记录于 {new Date(lastQuestion.askedAt).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <p className="text-sm">{lastQuestion.title}</p>
                      <Button size="sm" variant="outline" onClick={handleReviewLast} className="self-start">
                        继续温习
                      </Button>
                    </CardContent>
                  </Card>
                )}

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
                          <KnowledgeGraph
                            items={message.cards}
                            centerLabel=""
                            onFollowUp={handleFollowUp}
                          />
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
                        className={`border ${accent.includes('amber') ? 'animate-pulse-slow' : ''} border-border/70 bg-gradient-to-br ${accent}`}
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
  );
}

function KnowledgeGraph({
  items,
  centerLabel,
  onFollowUp,
}: {
  items: AssistantCardItem[];
  centerLabel: string;
  onFollowUp: (question: string) => void;
}) {
  const nodes = useMemo(() => {
    if (!items || items.length === 0) return [] as Array<AssistantCardItem & { x: number; y: number; angle: number }>;
    const radius = 36;
    const count = items.length;
    return items.map((item, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(count, 1);
      return {
        ...item,
        angle,
        x: 50 + radius * Math.cos(angle),
        y: 50 + radius * Math.sin(angle),
      };
    });
  }, [items]);

  // 计算所有节点的边，确保每个节点都有连线
  const edges = useMemo(() => {
    if (nodes.length === 0) return [];
    return nodes.map((node) => {
      const midX = (50 + node.x) / 2;
      const midY = (50 + node.y) / 2;
      const angleDeg = (node.angle * 180) / Math.PI;
      const readableAngle = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;
      
      return {
        fromX: 50,
        fromY: 50,
        toX: node.x,
        toY: node.y,
        midX,
        midY,
        readableAngle,
        relationship: node.relationship
      };
    });
  }, [nodes]);

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-sky-950/35 via-slate-900/50 to-emerald-900/35 p-4 text-foreground shadow-[0_20px_40px_-30px_rgba(0,0,0,0.7)]">
      <div className="relative aspect-square w-full min-h-[260px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {/* 绘制所有边 */}
          {edges.map((edge, idx) => (
            <g key={`edge-${idx}`} className="text-xs" opacity={0.9}>
              <line
                x1={edge.fromX}
                y1={edge.fromY}
                x2={edge.toX}
                y2={edge.toY}
                stroke="url(#edgeGradient)"
                strokeWidth={1.4}
                strokeLinecap="round"
              />
              {edge.relationship && (
                <text
                  x={edge.midX}
                  y={edge.midY}
                  fill="hsl(var(--muted-foreground))"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="2.6"
                  transform={`rotate(${edge.readableAngle}, ${edge.midX}, ${edge.midY})`}
                >
                  {edge.relationship}
                </text>
              )}
            </g>
          ))}
          
          <defs>
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(59,130,246,0.65)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.65)" />
            </linearGradient>
          </defs>
        </svg>

        {/* 中心节点 */}
        <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-sky-300/55 bg-gradient-to-br from-slate-800/80 to-slate-900/90 text-center text-xs font-semibold text-white/70 shadow-lg">
          <span className="px-2 leading-snug">{centerLabel}</span>
        </div>

        {/* 外围节点 */}
        {nodes.map((node, idx) => (
          <Tooltip key={`node-${idx}`}>
            <TooltipTrigger asChild>
              <button
                className="absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/80 text-center text-xs font-medium text-foreground shadow-md transition hover:scale-105 hover:border-sky-300/70 hover:bg-background/95"
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
        ))}
      </div>
    </div>
  );
}