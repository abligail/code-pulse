'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, PageHeaderDescription, PageHeaderHeading, PageHeaderTitle } from '@/components/ui/page-header';
import { PageState } from '@/components/ui/page-state';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getActiveUser } from '@/lib/auth/session';
import { readQuizHistoryEntries, QUIZ_HISTORY_EVENT, getQuizHistoryStorageKey, type QuizHistoryEntry } from '@/lib/storage/quiz-history';

const preferenceLabelMap: Record<string, string> = {
  content_format: '内容形式',
  difficulty_level: '难度节奏',
  review_time_preference: '复习时间',
};

const formatPreferenceKey = (key: string) => {
  if (preferenceLabelMap[key]) return preferenceLabelMap[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatPreferenceValue = (value: unknown) => {
  if (Array.isArray(value)) return value.join(' / ');
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface WeakKnowledgePoint {
  knowledge_id: string;
  knowledge_name: string;
  knowledge_category: string[];
  weak_reason: string;
  weak_score: number | string;
  first_weak_time: string;
  last_review_time: string | null;
  review_count: number | string;
}

interface UserProfileResponse {
  user_id: string;
  user_name: string;
  profile_update_time?: string;
  learning_preference?: Record<string, unknown>;
  weak_knowledge?: WeakKnowledgePoint[];
}

export default function ReportPage() {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryEntry[]>([]);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const user = getActiveUser();
      const userId = user?.userId ?? 'guest';
      const response = await fetch(`/api/user-profile?userId=${encodeURIComponent(userId)}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Profile request failed: ${response.status}`);
      }
      const rawText = await response.text();
      const parsed: unknown = JSON.parse(rawText);
      const profileContainer = parsed as UserProfileResponse & { user_profile?: UserProfileResponse };
      const resolved = profileContainer.user_profile ?? profileContainer;
      setProfile(resolved);
    } catch (error) {
      console.error('Failed to load user profile', error);
      setProfile(null);
      setProfileError('用户画像加载失败，请稍后重试。');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const syncQuizHistory = useCallback(() => {
    const userId = getActiveUser()?.userId;
    setQuizHistory(readQuizHistoryEntries(userId));
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    syncQuizHistory();
    if (typeof window === 'undefined') return;
    const handleCustom = () => syncQuizHistory();
    const handleStorage = (event: StorageEvent) => {
      const scopedKey = getQuizHistoryStorageKey(getActiveUser()?.userId);
      if (event.key === scopedKey) {
        syncQuizHistory();
      }
    };
    window.addEventListener(QUIZ_HISTORY_EVENT, handleCustom);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(QUIZ_HISTORY_EVENT, handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, [syncQuizHistory]);

  const preferenceEntries = useMemo(() => {
    if (!profile?.learning_preference) return [] as Array<{ label: string; value: string }>;
    return Object.entries(profile.learning_preference).map(([key, value]) => ({
      label: formatPreferenceKey(key),
      value: formatPreferenceValue(value),
    }));
  }, [profile]);

  const weakKnowledge = profile?.weak_knowledge ?? [];
  const sortedQuizHistory = useMemo(
    () => quizHistory.slice().sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [quizHistory]
  );

  return (
    <div className="h-[calc(100vh-73px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageHeaderTitle>学习回顾</PageHeaderTitle>
            <PageHeaderDescription>集中呈现你的个人画像与薄弱点练习记录</PageHeaderDescription>
          </PageHeaderHeading>
        </PageHeader>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>用户画像</CardTitle>
              <CardDescription>基于最新的画像接口实时拉取，薄弱点信息保持 GET 模式</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadProfile()} disabled={profileLoading}>
              刷新画像
            </Button>
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <PageState variant="loading" size="sm" className="border-0 bg-transparent" description="正在同步用户画像..." />
            ) : profileError ? (
              <PageState
                variant="error"
                size="sm"
                className="border-0 bg-transparent"
                title="用户画像获取失败"
                description={profileError}
                action={(
                  <Button variant="outline" size="sm" onClick={() => void loadProfile()}>
                    重试
                  </Button>
                )}
              />
            ) : !profile ? (
              <PageState
                variant="empty"
                size="sm"
                className="border-0 bg-transparent"
                title="暂无画像数据"
                description="请先完成一轮薄弱点分析后再查看。"
              />
            ) : (
              <div className="space-y-8">
                <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                  <div className="space-y-6">
                    <section>
                      <h4 className="text-sm font-semibold text-muted-foreground">基本信息</h4>
                      <div className="mt-3 space-y-3 text-sm">
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                          <span className="text-muted-foreground">用户名</span>
                          <span className="font-medium">{profile.user_name || '未命名用户'}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                          <span className="text-muted-foreground">用户 ID</span>
                          <span className="font-mono text-xs">{profile.user_id}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                          <span className="text-muted-foreground">画像更新时间</span>
                          <span className="text-xs">{formatDateTime(profile.profile_update_time)}</span>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-sm font-semibold text-muted-foreground">学习偏好</h4>
                      {preferenceEntries.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {preferenceEntries.map((item) => (
                            <div
                              key={item.label}
                              className="rounded-full border border-border/60 bg-background px-3 py-1 text-[12px]"
                            >
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="mx-1 text-muted-foreground">·</span>
                              <span className="font-medium text-foreground">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">暂无偏好信息。</p>
                      )}
                    </section>
                  </div>

                  <section>
                    <h4 className="text-sm font-semibold text-muted-foreground">薄弱知识点（列表展示）</h4>
                    {weakKnowledge.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">暂无薄弱知识点记录。</p>
                    ) : (
                      <ul className="mt-3 space-y-4">
                        {weakKnowledge.map((item) => {
                          const weakScore = Number(item.weak_score);
                          const scoreLabel = Number.isNaN(weakScore) ? '未评分' : `薄弱度 ${weakScore}`;
                          const reviewCount = Number(item.review_count ?? 0);
                          const reviewLabel = Number.isNaN(reviewCount) ? '—' : `${reviewCount} 次`;
                          return (
                            <li key={item.knowledge_id} className="rounded-2xl border border-border/70 bg-card/80 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{item.knowledge_name}</p>
                                  <p className="text-xs text-muted-foreground">{item.knowledge_id}</p>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {scoreLabel}
                                </Badge>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                {item.knowledge_category?.map((category) => (
                                  <Badge key={`${item.knowledge_id}-${category}`} variant="outline" className="text-[11px]">
                                    {category}
                                  </Badge>
                                ))}
                                <span className="rounded-full border border-border/60 px-2 py-0.5">复习 {reviewLabel}</span>
                              </div>
                              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.weak_reason}</p>
                              <dl className="mt-4 grid gap-3 text-[12px] text-muted-foreground sm:grid-cols-2">
                                <div className="flex items-center justify-between">
                                  <span>首次发现</span>
                                  <span className="text-foreground">{formatDateTime(item.first_weak_time)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>上次复习</span>
                                  <span className="text-foreground">{formatDateTime(item.last_review_time)}</span>
                                </div>
                              </dl>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>做题记录</CardTitle>
            <CardDescription>聊天页薄弱点练习提交后自动入库（仅本地存储，不随刷新丢失）</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedQuizHistory.length === 0 ? (
              <PageState
                variant="empty"
                size="sm"
                className="border-0 bg-transparent"
                title="暂无做题记录"
                description="在聊天界面提交一次薄弱点练习后即可在此查看题目与解析。"
              />
            ) : (
              <Accordion type="single" collapsible className="divide-y divide-border/60 rounded-2xl border border-border/70">
                {sortedQuizHistory.map((entry) => (
                  <AccordionItem key={entry.id} value={entry.id} className="px-4 py-2">
                    <AccordionTrigger className="text-left">
                      <div className="flex flex-1 flex-col gap-1 text-left">
                        <span className="font-medium text-foreground">{entry.knowledgeName || '未命名练习'}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(entry.occurredAt)} · {entry.questions.length} 道题
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {entry.knowledgeCategory.map((category) => (
                          <Badge key={`${entry.id}-${category}`} variant="outline" className="text-[11px]">
                            {category}
                          </Badge>
                        ))}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                        {entry.review || '暂无解析记录'}
                      </div>
                      <div className="space-y-4">
                        {entry.questions.map((question, index) => {
                          const badgeTone =
                            question.checkResult === 'correct'
                              ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                              : question.checkResult === 'wrong'
                                ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                                : 'bg-muted text-muted-foreground border-border/60';
                          const resultLabel =
                            question.checkResult === 'correct' ? '正确' : question.checkResult === 'wrong' ? '错误' : '待判定';
                          return (
                            <div key={`${entry.id}-q${index}`} className="rounded-2xl border border-border/70 bg-card/80 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-foreground">Q{index + 1} · {question.type}</span>
                                <Badge variant="outline" className={`text-[11px] ${badgeTone}`}>
                                  {resultLabel}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-foreground">{question.stem}</p>
                              {question.options.length > 0 && (
                                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {question.options.map((option, optIndex) => (
                                    <li key={`${entry.id}-q${index}-opt${optIndex}`} className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs leading-relaxed">
                                      <span className="mr-2 font-semibold text-muted-foreground">{String.fromCharCode(65 + optIndex)}.</span>
                                      {option}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <dl className="mt-4 space-y-2 text-xs">
                                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                                  <span className="text-muted-foreground">你的作答</span>
                                  <span className="text-foreground">{question.userAnswer || '未作答'}</span>
                                </div>
                                {question.referenceAnswer && (
                                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                                    <span className="text-muted-foreground">参考答案</span>
                                    <span className="text-foreground">{question.referenceAnswer}</span>
                                  </div>
                                )}
                                {question.analysis && (
                                  <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-muted-foreground">
                                    {question.analysis}
                                  </div>
                                )}
                              </dl>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
