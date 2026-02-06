'use client';

import { useMemo, useState, useEffect } from 'react';
import { RefreshCw, BookOpen, AlertTriangle, TrendingDown, Calendar, Loader2, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderHeading, PageHeaderTitle } from '@/components/ui/page-header';
import { PageState } from '@/components/ui/page-state';
import { ClientIcon } from '@/components/client-icon';
import { KnowledgeCardsPanel } from '@/components/knowledge-cards-panel';
import { fetchKnowledgeCards, type KnowledgeCard } from '@/lib/api/chat';
import { fetchUserProfile, type UserProfile } from '@/lib/api/profile';
import { fetchUserEvents, logUserEvent } from '@/lib/api/events';
import type { UserEventDTO } from '@/lib/api/types';

const getMasteryColor = (mastery: number) => {
  if (mastery <= 2) return 'bg-red-500';
  if (mastery === 3) return 'bg-yellow-500';
  if (mastery === 4) return 'bg-green-400';
  return 'bg-green-600';
};

const getMasteryLabel = (mastery: number) => {
  if (mastery <= 2) return '薄弱';
  if (mastery === 3) return '一般';
  if (mastery === 4) return '良好';
  return '优秀';
};

const quickQuiz = {
  question: '以下哪种情况最容易导致段错误？',
  options: ['使用未初始化指针', 'for 循环越界', '释放后继续访问指针', '以上都有可能'],
  answerIndex: 3,
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (base: Date, days: number) => {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
};

const parseDateLabel = (value: string) => {
  if (!value) return null;
  const today = startOfDay(new Date());

  if (value.includes('今天')) return today;
  if (value.includes('明天')) return addDays(today, 1);
  if (value.includes('昨天')) return addDays(today, -1);

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDateLabel = (value: string) => {
  const date = parseDateLabel(value);
  if (!date) return value;
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

const getDueBadge = (value: string) => {
  const date = parseDateLabel(value);
  if (!date) return null;
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  if (date < today) {
    return { label: '已逾期', className: 'bg-red-50 text-red-700 border-red-200' };
  }
  if (isSameDay(date, today)) {
    return { label: '今日', className: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
  if (isSameDay(date, tomorrow)) {
    return { label: '明日', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  return { label: formatDateLabel(value), className: 'bg-muted text-muted-foreground' };
};

const eventTypeLabel: Record<UserEventDTO['eventType'], string> = {
  chat_round: '完成一轮问答',
  practice_submit: '提交练习',
  review_run: '运行并评审代码',
  quiz_submit: '提交快速测验',
  knowledge_card_open: '查看知识卡',
};

const eventTypeTone: Record<UserEventDTO['eventType'], string> = {
  chat_round: 'bg-blue-50 text-blue-700 border-blue-200',
  practice_submit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  review_run: 'bg-amber-50 text-amber-700 border-amber-200',
  quiz_submit: 'bg-purple-50 text-purple-700 border-purple-200',
  knowledge_card_open: 'bg-slate-50 text-slate-700 border-slate-200',
};

export default function ReportPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [events, setEvents] = useState<UserEventDTO[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<UserEventDTO['eventType'] | 'all'>('all');
  const [eventSourceFilter, setEventSourceFilter] = useState('all');
  const [eventQuery, setEventQuery] = useState('');
  const [knowledgeCards, setKnowledgeCards] = useState<KnowledgeCard[]>([]);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [cardsTopic, setCardsTopic] = useState('');
  const [showCards, setShowCards] = useState(true);
  const [selectedCard, setSelectedCard] = useState<KnowledgeCard | null>(null);

  useEffect(() => {
    fetchProfile();
    loadEvents();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserProfile();
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setProfile(null);
      setError('学习报告加载失败，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEvents = async () => {
    setIsEventsLoading(true);
    setEventsError(null);
    try {
      const data = await fetchUserEvents(8);
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch user events:', error);
      setEvents([]);
      setEventsError('学习足迹加载失败，请稍后重试。');
    } finally {
      setIsEventsLoading(false);
    }
  };

  const handleGenerateReview = async () => {
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      await fetchProfile();
    } catch (error) {
      console.error('Failed to generate review:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const openKnowledgeCards = async (topic: string) => {
    setCardsTopic(topic);
    setCardsOpen(true);
    setCardsLoading(true);
    setCardsError(null);
    setSelectedCard(null);
    setShowCards(true);
    try {
      const data = await fetchKnowledgeCards([{ name: topic, type: 'concept' }]);
      setKnowledgeCards(data.cards || []);
    } catch (error) {
      console.error('Failed to fetch knowledge cards:', error);
      setKnowledgeCards([]);
      setCardsError('知识卡片加载失败，请稍后重试。');
    } finally {
      setCardsLoading(false);
    }
  };

  const reviewQueue = useMemo(() => {
    if (!profile) return [] as Array<{ nodeId: string; name: string; dueAt: string; reason: 'ebbinghaus' | 'weak' | 'teacher' }>;
    if (profile.reviewQueue && profile.reviewQueue.length > 0) {
      return profile.reviewQueue;
    }
    return profile.reviewPlan.map((plan, index) => ({
      nodeId: `plan-${index}`,
      name: plan.name,
      dueAt: plan.nextAt,
      reason: 'ebbinghaus' as const,
    }));
  }, [profile]);

  const todayQueue = useMemo(() => {
    const today = startOfDay(new Date());
    const endOfToday = addDays(today, 1);
    return reviewQueue.filter((item) => {
      const date = parseDateLabel(item.dueAt);
      if (!date) return false;
      return date < endOfToday;
    });
  }, [reviewQueue]);

  const eventSources = useMemo(() => {
    return Array.from(new Set(events.map((event) => event.source).filter(Boolean)));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = eventQuery.trim().toLowerCase();
    return events.filter((event) => {
      if (eventTypeFilter !== 'all' && event.eventType !== eventTypeFilter) return false;
      if (eventSourceFilter !== 'all' && event.source !== eventSourceFilter) return false;
      if (!query) return true;

      const knowledgeText =
        event.knowledgeNodes?.map((node) => node.nodeName ?? node.nodeId).join(' ') ?? '';
      const metrics = event.metrics as Record<string, unknown> | undefined;
      const metricParts: string[] = [];
      if (metrics) {
        if (metrics.practiceId) metricParts.push(String(metrics.practiceId));
        if (metrics.topic) metricParts.push(String(metrics.topic));
        if (metrics.level) metricParts.push(String(metrics.level));
        if (metrics.errorType) metricParts.push(String(metrics.errorType));
        if (metrics.sourceTag) metricParts.push(String(metrics.sourceTag));
        if (Object.prototype.hasOwnProperty.call(metrics, 'score')) {
          metricParts.push(String(metrics.score));
        }
      }

      const haystack = [
        event.eventType,
        event.source,
        knowledgeText,
        metricParts.join(' '),
        event.eventId,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [eventQuery, eventSourceFilter, eventTypeFilter, events]);

  const hasEventFilters =
    eventTypeFilter !== 'all' || eventSourceFilter !== 'all' || eventQuery.trim().length > 0;

  const resetEventFilters = () => {
    setEventTypeFilter('all');
    setEventSourceFilter('all');
    setEventQuery('');
  };

  const handleQuizSubmit = () => {
    if (quizChoice === null) return;
    setQuizSubmitted(true);

    const isCorrect = quizChoice === quickQuiz.answerIndex;
    void logUserEvent({
      eventType: 'quiz_submit',
      source: 'student/report',
      metrics: {
        correct: isCorrect,
        choiceIndex: quizChoice,
      },
    }).then(() => loadEvents());
  };

  const resetQuiz = () => {
    setQuizChoice(null);
    setQuizSubmitted(false);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-73px)] p-6 flex">
        <PageState variant="loading" className="w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-73px)] p-6 flex">
        <PageState
          variant="error"
          title="学习报告加载失败"
          description={error}
          action={(
            <Button onClick={fetchProfile} variant="outline">
              重试
            </Button>
          )}
          className="w-full"
        />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-73px)] overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto">
        <PageHeader className="mb-6">
          <PageHeaderHeading>
            <PageHeaderTitle>学习报告</PageHeaderTitle>
            <PageHeaderDescription>汇总你的学习节奏、薄弱点与复习建议</PageHeaderDescription>
          </PageHeaderHeading>
          <PageHeaderActions>
            <Button
              onClick={handleGenerateReview}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <ClientIcon icon={Loader2} className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <ClientIcon icon={RefreshCw} className="w-4 h-4 mr-2" />
                  一键生成复习卡片
                </>
              )}
            </Button>
          </PageHeaderActions>
        </PageHeader>

        {profile && (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClientIcon icon={Target} className="w-5 h-5 text-primary" />
                    今日复习队列
                  </CardTitle>
                  <CardDescription>建议今天完成的重点内容</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {todayQueue.length === 0 ? (
                    <div className="text-sm text-muted-foreground">今天暂无复习任务。</div>
                  ) : (
                    todayQueue.slice(0, 4).map(item => {
                      const dueBadge = getDueBadge(item.dueAt);
                      return (
                        <div key={item.nodeId} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <div>
                            <div className="text-sm font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">截止：{formatDateLabel(item.dueAt)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {item.reason === 'teacher' ? '教师要求' : item.reason === 'weak' ? '薄弱点' : '遗忘曲线'}
                            </Badge>
                            {dueBadge && (
                              <Badge variant="outline" className={`text-xs ${dueBadge.className}`}>
                                {dueBadge.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClientIcon icon={Sparkles} className="w-5 h-5 text-primary" />
                    快速测验
                  </CardTitle>
                  <CardDescription>用 1 分钟检验掌握度</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm font-medium">{quickQuiz.question}</div>
                  <div className="grid gap-2">
                    {quickQuiz.options.map((option, index) => {
                      const selected = quizChoice === index;
                      const correct = quizSubmitted && index === quickQuiz.answerIndex;
                      const incorrect = quizSubmitted && selected && index !== quickQuiz.answerIndex;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setQuizChoice(index)}
                          className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${selected ? 'border-primary bg-primary/10' : 'hover:bg-muted'} ${correct ? 'border-green-500 bg-green-50' : ''} ${incorrect ? 'border-destructive bg-destructive/10' : ''}`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleQuizSubmit} disabled={quizChoice === null || quizSubmitted}>
                      提交答案
                    </Button>
                    <Button size="sm" variant="outline" onClick={resetQuiz}>
                      重置
                    </Button>
                  </div>
                  {quizSubmitted && (
                    <div className="text-sm text-muted-foreground">
                      {quizChoice === quickQuiz.answerIndex ? '回答正确，保持节奏。' : '答案是：以上都有可能，建议复盘指针与边界检查。'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClientIcon icon={TrendingDown} className="w-5 h-5 text-destructive" />
                    薄弱知识点 Top 5
                  </CardTitle>
                  <CardDescription>需要重点关注的知识领域</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {profile.weakPoints.slice(0, 5).map((point, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{point.name}</span>
                              <Badge variant="outline" className="text-xs">{point.nodeType}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{point.lastSeen}</span>
                              <Badge 
                                variant="secondary"
                                className={`text-white ${getMasteryColor(point.mastery)}`}
                              >
                                {getMasteryLabel(point.mastery)} ({point.mastery}/5)
                              </Badge>
                            </div>
                          </div>
                          <Progress value={point.mastery * 20} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClientIcon icon={AlertTriangle} className="w-5 h-5 text-destructive" />
                    错误类型分布
                  </CardTitle>
                  <CardDescription>最近出现的错误类型统计</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {profile.errorStats.map((stat, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{stat.type}</span>
                            <span className="text-sm text-muted-foreground">{stat.count} 次</span>
                          </div>
                          <Progress 
                            value={(stat.count / Math.max(...profile.errorStats.map(s => s.count))) * 100} 
                            className="h-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {profile.errorStats.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      暂无错误记录，继续保持！
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClientIcon icon={Calendar} className="w-5 h-5 text-primary" />
                    复习计划
                  </CardTitle>
                  <CardDescription>基于你的学习情况推荐的复习任务</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {profile.reviewPlan.map((plan, i) => (
                      <Card key={i} className="border-primary">
                        <CardHeader className="pb-3">
                          <CardDescription>{formatDateLabel(plan.nextAt)}</CardDescription>
                          <CardTitle className="text-base">{plan.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Button variant="outline" className="w-full text-sm" onClick={() => openKnowledgeCards(plan.name)}>
                            <ClientIcon icon={BookOpen} className="w-4 h-4 mr-2" />
                            去看概念卡
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {profile.reviewPlan.length === 0 && (
                      <div className="md:col-span-3 text-center py-8 text-muted-foreground">
                        暂无复习计划，点击右上角"一键生成复习卡片"
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>学习建议</CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <BookOpen className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2 mt-2">
                        <p className="font-medium">个性化建议：</p>
                        <div className="space-y-1 ml-2 text-sm">
                          <div>• 重点关注指针运算和链表操作，这些是薄弱环节</div>
                          <div>• 减少段错误和数组越界，注意内存边界检查</div>
                          <div>• 建议每天练习1-2道题，巩固基础知识</div>
                          <div>• 遇到问题时，先尝试自己思考，再看提示</div>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>学习足迹</CardTitle>
                    <CardDescription>最近的学习操作记录</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={loadEvents}>
                    刷新
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[160px_200px_1fr]">
                    <Select value={eventTypeFilter} onValueChange={(value) => setEventTypeFilter(value as UserEventDTO['eventType'] | 'all')}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="全部类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部类型</SelectItem>
                        {Object.entries(eventTypeLabel).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={eventSourceFilter} onValueChange={setEventSourceFilter}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="全部来源" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部来源</SelectItem>
                        {eventSources.map((source) => (
                          <SelectItem key={source} value={source}>
                            {source}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      value={eventQuery}
                      onChange={(event) => setEventQuery(event.target.value)}
                      placeholder="搜索来源 / 知识点 / 难度 / 得分"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>已筛选 {filteredEvents.length} / {events.length}</span>
                    {hasEventFilters && (
                      <Button variant="ghost" size="sm" onClick={resetEventFilters}>
                        清除筛选
                      </Button>
                    )}
                  </div>

                  {isEventsLoading ? (
                    <PageState
                      variant="loading"
                      size="sm"
                      className="border-0 bg-transparent"
                      description="正在加载学习足迹..."
                    />
                  ) : eventsError ? (
                    <PageState
                      variant="error"
                      size="sm"
                      className="border-0 bg-transparent"
                      title="学习足迹加载失败"
                      description={eventsError}
                      action={(
                        <Button variant="outline" size="sm" onClick={loadEvents}>
                          重试
                        </Button>
                      )}
                    />
                  ) : filteredEvents.length === 0 ? (
                    <PageState
                      variant="empty"
                      size="sm"
                      className="border-0 bg-transparent"
                      title="暂无匹配记录"
                      description={events.length === 0 ? '完成一次学习动作后会出现在这里。' : '可调整筛选条件继续查看。'}
                    />
                  ) : (
                    <div className="space-y-3">
                      {filteredEvents.map((event) => {
                        const label = eventTypeLabel[event.eventType];
                        const timeLabel = new Date(event.occurredAt).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const metrics = event.metrics as Record<string, unknown> | undefined;
                        const score = metrics?.score as number | string | undefined;
                        const correct = metrics?.correct as boolean | undefined;
                        const success = metrics?.success as boolean | undefined;
                        const errorType = metrics?.errorType as string | undefined;
                        const topic = metrics?.topic as string | undefined;
                        const level = metrics?.level as string | undefined;
                        const sourceTag = metrics?.sourceTag as string | undefined;
                        const nodeType = metrics?.nodeType as string | undefined;
                        const messageLength = metrics?.messageLength as number | undefined;
                        const followupCount = metrics?.followupCount as number | undefined;
                        const knowledgeLabel = event.knowledgeNodes?.[0]?.nodeName || event.knowledgeNodes?.[0]?.nodeId;
                        const scoreNumber = typeof score === 'number' ? score : Number(score);
                        const hasScore = score !== undefined && score !== null && score !== '';
                        const scoreTone =
                          !Number.isNaN(scoreNumber) && hasScore
                            ? scoreNumber >= 60
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-muted text-muted-foreground';
                        const statusTone = (value: boolean) =>
                          value ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200';
                        const detail =
                          event.eventType === 'practice_submit'
                            ? `得分 ${hasScore ? score : '-'}`
                            : event.eventType === 'quiz_submit'
                              ? correct === undefined
                                ? '完成测验'
                                : correct
                                  ? '答题正确'
                                  : '答题错误'
                              : event.eventType === 'knowledge_card_open'
                                ? knowledgeLabel || '知识卡'
                                : event.eventType === 'review_run'
                                  ? success
                                    ? '运行成功'
                                    : errorType || '运行失败'
                                  : '';
                        const title = detail || event.source || '学习事件';

                        return (
                          <div key={event.eventId} className="rounded-lg border border-dashed p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className={`text-xs ${eventTypeTone[event.eventType]}`}>
                                    {label}
                                  </Badge>
                                  <span className="text-sm font-medium">{title}</span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-xs">
                                    来源 {event.source}
                                  </Badge>
                                  {knowledgeLabel && (
                                    <Badge variant="secondary" className="text-xs">
                                      知识点 {knowledgeLabel}
                                    </Badge>
                                  )}
                                  {nodeType && (
                                    <Badge variant="outline" className="text-xs">
                                      类型 {nodeType}
                                    </Badge>
                                  )}
                                  {hasScore && (
                                    <Badge variant="outline" className={`text-xs ${scoreTone}`}>
                                      得分 {score}
                                    </Badge>
                                  )}
                                  {typeof correct === 'boolean' && (
                                    <Badge variant="outline" className={`text-xs ${statusTone(correct)}`}>
                                      {correct ? '测验正确' : '测验错误'}
                                    </Badge>
                                  )}
                                  {typeof success === 'boolean' && (
                                    <Badge variant="outline" className={`text-xs ${statusTone(success)}`}>
                                      {success ? '运行成功' : '运行失败'}
                                    </Badge>
                                  )}
                                  {errorType && (
                                    <Badge variant="outline" className="text-xs">
                                      错误 {errorType}
                                    </Badge>
                                  )}
                                  {topic && (
                                    <Badge variant="outline" className="text-xs">
                                      主题 {topic}
                                    </Badge>
                                  )}
                                  {level && (
                                    <Badge variant="outline" className="text-xs">
                                      难度 {level}
                                    </Badge>
                                  )}
                                  {sourceTag && (
                                    <Badge variant="outline" className="text-xs">
                                      推荐来源 {sourceTag}
                                    </Badge>
                                  )}
                                  {typeof messageLength === 'number' && (
                                    <Badge variant="outline" className="text-xs">
                                      字数 {messageLength}
                                    </Badge>
                                  )}
                                  {typeof followupCount === 'number' && (
                                    <Badge variant="outline" className="text-xs">
                                      追问 {followupCount}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap">{timeLabel}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
      <Sheet open={cardsOpen} onOpenChange={setCardsOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[480px]">
          <div className="flex items-start justify-between gap-4 border-b pb-4">
            <div>
              <h3 className="text-base font-semibold">概念卡</h3>
              <p className="text-xs text-muted-foreground">
                {cardsTopic ? `来自 ${cardsTopic}` : '根据复习计划推荐'}
              </p>
            </div>
            {cardsTopic && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openKnowledgeCards(cardsTopic)}
                disabled={cardsLoading}
              >
                {cardsLoading ? '刷新中...' : '刷新'}
              </Button>
            )}
          </div>

          <div className="mt-4">
            {cardsLoading ? (
              <PageState
                variant="loading"
                size="sm"
                className="border-0 bg-transparent p-0 md:p-0"
                description="正在加载知识卡片..."
              />
            ) : cardsError ? (
              <PageState
                variant="error"
                size="sm"
                className="border-0 bg-transparent p-0 md:p-0"
                title="知识卡片加载失败"
                description={cardsError}
                action={(
                  <Button size="sm" variant="outline" onClick={() => openKnowledgeCards(cardsTopic)}>
                    重试
                  </Button>
                )}
              />
            ) : knowledgeCards.length === 0 ? (
              <PageState
                variant="empty"
                size="sm"
                className="border-0 bg-transparent p-0 md:p-0"
                title="暂无相关概念卡"
                description="建议稍后再试或调整复习主题。"
              />
            ) : (
              <KnowledgeCardsPanel
                cards={knowledgeCards}
                showCards={showCards}
                setShowCards={setShowCards}
                selectedCard={selectedCard}
                setSelectedCard={setSelectedCard}
                onCardOpen={(card) => {
                  void logUserEvent({
                    eventType: 'knowledge_card_open',
                    source: 'student/report',
                    knowledgeNodes: [{ nodeId: card.id, nodeName: card.title }],
                    metrics: { nodeType: card.nodeType },
                  });
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
