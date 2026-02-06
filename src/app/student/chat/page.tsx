'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Plus,
  MessageSquare,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderHeading, PageHeaderMeta, PageHeaderTitle } from '@/components/ui/page-header';
import { ClientIcon } from '@/components/client-icon';
import { KnowledgeCardsPanel } from '@/components/knowledge-cards-panel';
import { fetchKnowledgeCards, sendChatMessage, type KnowledgeCard } from '@/lib/api/chat';
import { logUserEvent } from '@/lib/api/events';
import { getActiveUser, getLastQuestion, setLastQuestion, type LastQuestion } from '@/lib/auth/session';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  followups?: string[];
  timestamp: Date;
}

interface QuestionCard {
  title: string;
  prompt: string;
  hints: string[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeCards, setKnowledgeCards] = useState<KnowledgeCard[]>([]);
  const [showCards, setShowCards] = useState(true);
  const [selectedCard, setSelectedCard] = useState<KnowledgeCard | null>(null);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [lastEntities, setLastEntities] = useState<Array<{ name: string; type: string }>>([]);
  const [roundQuestion, setRoundQuestion] = useState<QuestionCard | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [lastQuestion, setLastQuestionState] = useState<LastQuestion | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: '你好！我是你的C语言学习助教。你可以问我关于C语言的任何问题，我会引导你思考，而不是直接给出答案。',
        timestamp: new Date(),
      }
    ]);

    const user = getActiveUser();
    setLastQuestionState(getLastQuestion(user?.userId));
    loadKnowledgeCards([]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, roundQuestion]);

  const loadKnowledgeCards = async (entities: Array<{ name: string; type: string }>) => {
    setCardsLoading(true);
    setCardsError(null);
    setLastEntities(entities);
    try {
      const data = await fetchKnowledgeCards(entities);
      setKnowledgeCards(data.cards || []);
    } catch (error) {
      console.error('Failed to fetch knowledge cards:', error);
      setKnowledgeCards([]);
      setCardsError('知识卡片加载失败，请稍后重试。');
    } finally {
      setCardsLoading(false);
    }
  };

  const buildFallbackQuestion = (message: string): QuestionCard => {
    const trimmed = message.trim().slice(0, 24);
    return {
      title: '本轮思考题',
      prompt: `围绕“${trimmed || '本次话题'}”，请尝试用一句话说明核心概念，并举出一个容易出错的细节。`,
      hints: ['想想概念的定义', '回忆常见的边界情况', '用自己的话复述要点'],
    };
  };

  const formatMessageTime = (date: Date) =>
    date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const roundId = Date.now().toString();
    const userMessage: Message = {
      id: `${roundId}-u`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const data = await sendChatMessage({
        sessionId: 'current',
        message,
      });

      const assistantMessage: Message = {
        id: `${roundId}-a`,
        role: 'assistant',
        content: data.answer,
        followups: data.followups || [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      const nextQuestion = data.questionCard || buildFallbackQuestion(message);
      setRoundQuestion(nextQuestion);
      setIsFlipped(false);

      const user = getActiveUser();
      const nextLastQuestion = {
        id: roundId,
        title: nextQuestion.prompt,
        askedAt: new Date().toISOString(),
      };
      setLastQuestionState(nextLastQuestion);
      setLastQuestion(user?.userId, nextLastQuestion);

      void logUserEvent({
        eventType: 'chat_round',
        source: 'student/chat',
        roundId,
        conversationId: 'current',
        knowledgeNodes: data.entities?.map((entity) => ({
          nodeId: entity.name,
          nodeName: entity.name,
        })),
        metrics: {
          messageLength: message.length,
          followupCount: data.followups?.length || 0,
        },
      });

      if (data.entities && data.entities.length > 0) {
        await loadKnowledgeCards(data.entities);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，我遇到了一些问题。请稍后再试。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowUp = (followUp: string) => {
    handleSendMessage(followUp);
  };

  const startNewChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: '你好！我是你的C语言学习助教。你可以问我关于C语言的任何问题，我会引导你思考，而不是直接给出答案。',
        timestamp: new Date(),
      }
    ]);
    setSelectedCard(null);
    setRoundQuestion(null);
    setIsFlipped(false);
  };

  const handleReviewLast = () => {
    if (!lastQuestion) return;
    handleSendMessage(lastQuestion.title);
  };

  return (
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
                <PageHeaderMeta>
                  <span className="rounded-full border border-border/70 bg-muted/65 px-2.5 py-1 text-[11px]">
                    当前会话
                  </span>
                </PageHeaderMeta>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden">
                      <ClientIcon icon={MessageSquare} className="mr-2 h-4 w-4" />
                      知识卡片
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[400px] border-l border-border/70 bg-background/92 p-3 backdrop-blur-md">
                    <KnowledgeCardsPanel
                      cards={knowledgeCards}
                      showCards={showCards}
                      setShowCards={setShowCards}
                      selectedCard={selectedCard}
                      setSelectedCard={setSelectedCard}
                      isLoading={cardsLoading}
                      error={cardsError}
                      onRetry={() => loadKnowledgeCards(lastEntities)}
                      onCardOpen={(card) => {
                        void logUserEvent({
                          eventType: 'knowledge_card_open',
                          source: 'student/chat',
                          knowledgeNodes: [{ nodeId: card.id, nodeName: card.title }],
                          metrics: { nodeType: card.nodeType },
                        });
                      }}
                    />
                  </SheetContent>
                </Sheet>
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
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                      {message.followups && message.followups.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.followups.map((followUp, idx) => (
                            <Button
                              key={idx}
                              variant={message.role === 'user' ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => handleFollowUp(followUp)}
                              className="h-7 rounded-full px-3 text-xs shadow-none"
                            >
                              {followUp}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
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

          {roundQuestion && (
            <div className="border-t border-border/60 bg-muted/20 px-5 py-4 backdrop-blur-sm lg:px-6">
              <div className="mx-auto max-w-3xl">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClientIcon icon={Sparkles} className="h-4 w-4" />
                    <h4 className="font-semibold">本轮总结问题卡</h4>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setIsFlipped((prev) => !prev)}>
                    翻转卡片
                  </Button>
                </div>
                <QuestionFlipCard
                  question={roundQuestion}
                  flipped={isFlipped}
                  onToggle={() => setIsFlipped((prev) => !prev)}
                />
              </div>
            </div>
          )}

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

        <div className="hidden w-96 border-l border-border/65 bg-background/52 px-3 py-3 lg:block">
          <KnowledgeCardsPanel
            cards={knowledgeCards}
            showCards={showCards}
            setShowCards={setShowCards}
            selectedCard={selectedCard}
            setSelectedCard={setSelectedCard}
            isLoading={cardsLoading}
            error={cardsError}
            onRetry={() => loadKnowledgeCards(lastEntities)}
            onCardOpen={(card) => {
              void logUserEvent({
                eventType: 'knowledge_card_open',
                source: 'student/chat',
                knowledgeNodes: [{ nodeId: card.id, nodeName: card.title }],
                metrics: { nodeType: card.nodeType },
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function QuestionFlipCard({
  question,
  flipped,
  onToggle,
}: {
  question: QuestionCard;
  flipped: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ perspective: '1400px' }}>
      <div
        className="relative h-56 w-full transition-transform duration-500 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <Card
          className="absolute inset-0 flex h-full cursor-pointer flex-col overflow-hidden border-primary/30 bg-[linear-gradient(145deg,rgba(37,99,235,0.22),rgba(14,116,144,0.08),rgba(255,255,255,0.6))] py-5"
          style={{ backfaceVisibility: 'hidden' }}
          onClick={onToggle}
        >
          <CardHeader>
            <CardTitle className="text-base">问题卡已生成</CardTitle>
            <CardDescription>点击翻开，查看本轮总结问题</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 items-end">
            <div className="w-full rounded-xl border border-dashed border-primary/45 bg-background/60 p-3 text-xs text-muted-foreground">
              {question.title}
            </div>
          </CardContent>
        </Card>

        <Card
          className="absolute inset-0 flex h-full cursor-pointer flex-col overflow-hidden bg-card/96 py-5"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
          onClick={onToggle}
        >
          <CardHeader>
            <CardTitle className="text-base">{question.title}</CardTitle>
            <CardDescription>请先思考，再查看提示</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            <p className="text-sm leading-relaxed">{question.prompt}</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {question.hints.map((hint, index) => (
                <div key={index} className="rounded-lg border border-border/70 bg-muted/42 px-2.5 py-1.5">
                  提示 {index + 1}：{hint}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
