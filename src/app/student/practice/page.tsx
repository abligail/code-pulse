'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader, PageHeaderDescription, PageHeaderHeading, PageHeaderTitle } from '@/components/ui/page-header';
import { PageState } from '@/components/ui/page-state';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchTeacherAssignments,
  logUserEvent,
  submitTeacherAssignmentAnswer,
  type TeacherAssignmentAnswerPayload,
  type TeacherAssignmentQuestionType,
} from '@/lib/api/events';
import { getActiveUser } from '@/lib/auth/session';
import {
  fetchSinglePracticeQuestion,
  submitSinglePracticeAnswer,
  type ChoiceOption,
  type PracticeQuestion,
  type PracticeStrategy,
  type SingleAnswerResponse,
} from '@/lib/api/practice';
import type { UserEventDTO } from '@/lib/api/types';

const STRATEGY_LABEL: Record<PracticeStrategy, string> = {
  weakest: '补弱优先',
  spaced: '间隔重复',
};

const OPTION_ORDER: ChoiceOption[] = ['A', 'B', 'C', 'D'];
const ASSIGNMENT_OPTION_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];

interface TeacherAssignmentItem {
  eventId: string;
  assignmentId: string;
  version: number;
  title: string;
  stem: string;
  questionType: TeacherAssignmentQuestionType;
  options: string[];
  blankCount: number;
  note: string;
  senderId: string;
  senderName: string;
  sentAt: string;
  sentAtTs: number;
}

interface TeacherAssignmentAnswerDraft {
  selectedSingleIndex: number | null;
  blankAnswers: string[];
  essayAnswer: string;
}

interface AssignmentSubmitState {
  type: 'success' | 'error';
  message: string;
  submittedAt?: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const asStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
};

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const normalizeQuestionType = (value: unknown): TeacherAssignmentQuestionType => {
  if (value === 'single' || value === 'blank' || value === 'essay') return value;
  return 'essay';
};

const QUESTION_TYPE_LABEL: Record<TeacherAssignmentQuestionType, string> = {
  single: '选择题',
  blank: '填空题',
  essay: '简答题',
};

const createAssignmentAnswerDraft = (blankCount: number): TeacherAssignmentAnswerDraft => ({
  selectedSingleIndex: null,
  blankAnswers: Array.from({ length: Math.max(1, blankCount) }, () => ''),
  essayAnswer: '',
});

const syncAssignmentAnswerDrafts = (
  assignments: TeacherAssignmentItem[],
  previous: Record<string, TeacherAssignmentAnswerDraft>
) => {
  const next: Record<string, TeacherAssignmentAnswerDraft> = {};

  assignments.forEach((item) => {
    const existing = previous[item.assignmentId];
    const blankCount = Math.max(1, item.blankCount || 1);

    if (!existing) {
      next[item.assignmentId] = createAssignmentAnswerDraft(blankCount);
      return;
    }

    next[item.assignmentId] = {
      selectedSingleIndex:
        typeof existing.selectedSingleIndex === 'number' && existing.selectedSingleIndex >= 0
          ? existing.selectedSingleIndex
          : null,
      blankAnswers: Array.from({ length: blankCount }, (_, index) => existing.blankAnswers[index] || ''),
      essayAnswer: existing.essayAnswer || '',
    };
  });

  return next;
};

const toTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toTeacherAssignmentItem = (event: UserEventDTO): TeacherAssignmentItem | null => {
  const metrics = asRecord(event.metrics);
  const assignmentId = asString(metrics.assignmentId, asString(event.roundId));
  if (!assignmentId) return null;

  const sentAt = asString(metrics.sentAt, event.occurredAt);

  return {
    eventId: event.eventId,
    assignmentId,
    version: Math.max(1, Math.floor(asNumber(metrics.version, 1))),
    title: asString(metrics.title, '未命名题目'),
    stem: asString(metrics.stem),
    questionType: normalizeQuestionType(metrics.questionType),
    options: asStringArray(metrics.options),
    blankCount: Math.max(0, Math.floor(asNumber(metrics.blankCount, 0))),
    note: asString(metrics.note),
    senderId: asString(metrics.senderId),
    senderName: asString(metrics.senderName, '教师'),
    sentAt,
    sentAtTs: toTimestamp(sentAt),
  };
};

const mergeLatestAssignments = (events: UserEventDTO[]): TeacherAssignmentItem[] => {
  const latestMap = new Map<string, TeacherAssignmentItem>();

  events.forEach((event) => {
    const item = toTeacherAssignmentItem(event);
    if (!item) return;

    const current = latestMap.get(item.assignmentId);
    if (!current) {
      latestMap.set(item.assignmentId, item);
      return;
    }

    if (item.version > current.version) {
      latestMap.set(item.assignmentId, item);
      return;
    }

    if (item.version === current.version && item.sentAtTs >= current.sentAtTs) {
      latestMap.set(item.assignmentId, item);
    }
  });

  return Array.from(latestMap.values()).sort((a, b) => {
    if (b.sentAtTs !== a.sentAtTs) return b.sentAtTs - a.sentAtTs;
    if (b.version !== a.version) return b.version - a.version;
    return b.eventId.localeCompare(a.eventId);
  });
};

export default function PracticePage() {
  const [studentUserId, setStudentUserId] = useState('');
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignmentItem[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [assignmentAnswerDrafts, setAssignmentAnswerDrafts] = useState<Record<string, TeacherAssignmentAnswerDraft>>({});
  const [assignmentSubmittingMap, setAssignmentSubmittingMap] = useState<Record<string, boolean>>({});
  const [assignmentSubmitStates, setAssignmentSubmitStates] = useState<Record<string, AssignmentSubmitState>>({});

  const [strategy, setStrategy] = useState<PracticeStrategy>('weakest');
  const [question, setQuestion] = useState<PracticeQuestion | null>(null);
  const [zpdApplied, setZpdApplied] = useState(false);
  const [selectedOption, setSelectedOption] = useState<ChoiceOption | null>(null);
  const [answerResult, setAnswerResult] = useState<SingleAnswerResponse | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleOptions = useMemo(
    () => OPTION_ORDER.filter((key) => Boolean(question?.options[key])),
    [question]
  );

  const loadTeacherAssignmentSection = useCallback(async () => {
    if (!studentUserId) {
      setTeacherAssignments([]);
      setAssignmentsError(null);
      setExpandedAssignmentId(null);
      setAssignmentAnswerDrafts({});
      setAssignmentSubmittingMap({});
      setAssignmentSubmitStates({});
      return;
    }

    setAssignmentsLoading(true);
    setAssignmentsError(null);

    try {
      const response = await fetchTeacherAssignments({
        userId: studentUserId,
        limit: 300,
      });
      const merged = mergeLatestAssignments(response.events || []);
      setTeacherAssignments(merged);
      setAssignmentAnswerDrafts((prev) => syncAssignmentAnswerDrafts(merged, prev));
      setAssignmentSubmittingMap((prev) => {
        const next: Record<string, boolean> = {};
        merged.forEach((item) => {
          if (prev[item.assignmentId]) next[item.assignmentId] = true;
        });
        return next;
      });
      setAssignmentSubmitStates((prev) => {
        const next: Record<string, AssignmentSubmitState> = {};
        merged.forEach((item) => {
          const state = prev[item.assignmentId];
          if (state) next[item.assignmentId] = state;
        });
        return next;
      });
      setExpandedAssignmentId((prev) => {
        if (prev && merged.some((item) => item.assignmentId === prev)) return prev;
        return merged[0]?.assignmentId || null;
      });
    } catch (loadError) {
      console.error('Failed to load teacher assignments', loadError);
      setTeacherAssignments([]);
      setAssignmentsError('教师下发题目加载失败，请稍后重试。');
      setExpandedAssignmentId(null);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [studentUserId]);

  const updateAssignmentDraft = useCallback(
    (assignmentId: string, updater: (prev: TeacherAssignmentAnswerDraft) => TeacherAssignmentAnswerDraft) => {
      setAssignmentAnswerDrafts((prev) => {
        const current = prev[assignmentId] || createAssignmentAnswerDraft(1);
        return {
          ...prev,
          [assignmentId]: updater(current),
        };
      });
    },
    []
  );

  const handleTeacherSingleOptionChange = (assignmentId: string, index: number) => {
    updateAssignmentDraft(assignmentId, (prev) => ({
      ...prev,
      selectedSingleIndex: index,
    }));
  };

  const handleTeacherBlankAnswerChange = (assignmentId: string, index: number, value: string) => {
    updateAssignmentDraft(assignmentId, (prev) => ({
      ...prev,
      blankAnswers: (() => {
        const answers = prev.blankAnswers.slice();
        while (answers.length <= index) {
          answers.push('');
        }
        answers[index] = value;
        return answers;
      })(),
    }));
  };

  const handleTeacherEssayAnswerChange = (assignmentId: string, value: string) => {
    updateAssignmentDraft(assignmentId, (prev) => ({
      ...prev,
      essayAnswer: value,
    }));
  };

  const submitTeacherAssignment = async (item: TeacherAssignmentItem) => {
    const draft = assignmentAnswerDrafts[item.assignmentId] || createAssignmentAnswerDraft(Math.max(1, item.blankCount || 1));

    let answerPayload: TeacherAssignmentAnswerPayload | null = null;
    if (item.questionType === 'single') {
      const selectedIndex = draft.selectedSingleIndex;
      if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= item.options.length) {
        setAssignmentSubmitStates((prev) => ({
          ...prev,
          [item.assignmentId]: { type: 'error', message: '请选择一个答案后再提交。' },
        }));
        return;
      }

      const selectedText = item.options[selectedIndex] || '';
      answerPayload = {
        questionType: 'single',
        selectedIndex,
        selectedLabel: ASSIGNMENT_OPTION_ORDER[selectedIndex] || `${selectedIndex + 1}`,
        selectedText,
      };
    } else if (item.questionType === 'blank') {
      const answers = draft.blankAnswers.map((entry) => entry.trim());
      if (answers.some((entry) => entry.length === 0)) {
        setAssignmentSubmitStates((prev) => ({
          ...prev,
          [item.assignmentId]: { type: 'error', message: '请先填写所有空位答案。' },
        }));
        return;
      }
      answerPayload = {
        questionType: 'blank',
        answers,
      };
    } else {
      const answerText = draft.essayAnswer.trim();
      if (!answerText) {
        setAssignmentSubmitStates((prev) => ({
          ...prev,
          [item.assignmentId]: { type: 'error', message: '请输入答案后再提交。' },
        }));
        return;
      }
      answerPayload = {
        questionType: 'essay',
        answerText,
      };
    }

    if (!answerPayload) {
      setAssignmentSubmitStates((prev) => ({
        ...prev,
        [item.assignmentId]: { type: 'error', message: '答案格式错误，请重试。' },
      }));
      return;
    }

    setAssignmentSubmittingMap((prev) => ({ ...prev, [item.assignmentId]: true }));
    setAssignmentSubmitStates((prev) => {
      const next = { ...prev };
      delete next[item.assignmentId];
      return next;
    });

    try {
      const submittedAt = new Date().toISOString();
      await submitTeacherAssignmentAnswer({
        assignmentId: item.assignmentId,
        version: item.version,
        questionType: item.questionType,
        title: item.title,
        stem: item.stem,
        senderId: item.senderId,
        senderName: item.senderName,
        answer: answerPayload,
        submittedAt,
      });

      setAssignmentSubmitStates((prev) => ({
        ...prev,
        [item.assignmentId]: {
          type: 'success',
          message: '作答已提交。',
          submittedAt,
        },
      }));
    } catch (submitError) {
      console.error('Failed to submit teacher assignment answer', submitError);
      setAssignmentSubmitStates((prev) => ({
        ...prev,
        [item.assignmentId]: {
          type: 'error',
          message: '提交失败，请稍后重试。',
        },
      }));
    } finally {
      setAssignmentSubmittingMap((prev) => ({ ...prev, [item.assignmentId]: false }));
    }
  };

  useEffect(() => {
    const activeUser = getActiveUser();
    setStudentUserId(activeUser?.userId || '');
  }, []);

  useEffect(() => {
    void loadTeacherAssignmentSection();
  }, [loadTeacherAssignmentSection]);

  const loadQuestion = async () => {
    setIsLoadingQuestion(true);
    setError(null);
    setAnswerResult(null);
    setSelectedOption(null);
    try {
      const data = await fetchSinglePracticeQuestion(strategy);
      if (!data.question.id || !data.question.stem || OPTION_ORDER.every((key) => !data.question.options[key])) {
        throw new Error('题目数据不完整');
      }
      setQuestion(data.question);
      setZpdApplied(data.zpdApplied);
    } catch (loadError) {
      console.error('Failed to load single practice question', loadError);
      setQuestion(null);
      setError('获取题目失败，请确认后端接口已启动。');
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const submitAnswer = async () => {
    if (!question || !selectedOption || answerResult) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const data = await submitSinglePracticeAnswer({
        question_id: question.id,
        selected_option: selectedOption,
      });
      setAnswerResult(data);
      void logUserEvent({
        eventType: 'practice_submit',
        source: 'student/practice',
        metrics: {
          strategy,
          questionId: question.id,
          selectedOption: data.selectedOption,
          correctOption: data.correctOption,
          isCorrect: data.isCorrect,
          knowledgePoints: question.knowledgePoints,
        },
      });
    } catch (submitError) {
      console.error('Failed to submit single answer', submitError);
      setError('提交答案失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAnswered = Boolean(answerResult);

  return (
    <div className="h-[calc(100vh-73px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <PageHeader>
          <PageHeaderHeading>
            <PageHeaderTitle>练习与评测</PageHeaderTitle>
            <PageHeaderDescription>单题模式：补弱优先与间隔重复</PageHeaderDescription>
          </PageHeaderHeading>
        </PageHeader>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">教师下发题目</CardTitle>
                <CardDescription>
                  按 `assignmentId` 自动合并版本，只展示最新一次下发。
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadTeacherAssignmentSection}
                disabled={assignmentsLoading || !studentUserId}
              >
                {assignmentsLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    刷新中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    刷新下发题目
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!studentUserId ? (
              <PageState
                variant="empty"
                size="sm"
                className="border-0 bg-transparent"
                title="未识别学生账号"
                description="请先登录学生账号后刷新页面。"
              />
            ) : assignmentsLoading ? (
              <PageState variant="loading" size="sm" className="border-0 bg-transparent" />
            ) : assignmentsError ? (
              <PageState
                variant="error"
                size="sm"
                title="下发题目加载失败"
                description={assignmentsError}
                action={(
                  <Button type="button" variant="outline" onClick={loadTeacherAssignmentSection}>
                    重试
                  </Button>
                )}
                className="border-0 bg-transparent"
              />
            ) : teacherAssignments.length === 0 ? (
              <PageState
                variant="empty"
                size="sm"
                className="border-0 bg-transparent"
                title="暂无教师下发题目"
                description="教师下发后，这里会展示你收到的最新题目。"
              />
            ) : (
              <div className="space-y-3">
                {teacherAssignments.map((item) => {
                  const isExpanded = expandedAssignmentId === item.assignmentId;
                  const draft =
                    assignmentAnswerDrafts[item.assignmentId]
                    || createAssignmentAnswerDraft(Math.max(1, item.blankCount || 1));
                  const submitState = assignmentSubmitStates[item.assignmentId];
                  const isSubmittingAssignment = Boolean(assignmentSubmittingMap[item.assignmentId]);
                  const blankCount = Math.max(1, item.blankCount || 1);

                  return (
                    <div key={item.assignmentId} className="rounded-xl border border-border/70 bg-background p-4">
                      <button
                        type="button"
                        className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                        onClick={() =>
                          setExpandedAssignmentId((prev) =>
                            prev === item.assignmentId ? null : item.assignmentId
                          )}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            assignmentId: {item.assignmentId} · 教师：{item.senderName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            下发时间：{formatDateTime(item.sentAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">v{item.version}</Badge>
                          <Badge variant="secondary">{QUESTION_TYPE_LABEL[item.questionType]}</Badge>
                          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">题干</p>
                            <p className="text-sm leading-relaxed">{item.stem || '暂无题干'}</p>
                          </div>

                          {item.questionType === 'single' && (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">作答（单选）</p>
                              {item.options.length === 0 ? (
                                <p className="text-sm text-muted-foreground">暂无选项</p>
                              ) : (
                                <RadioGroup
                                  value={
                                    typeof draft.selectedSingleIndex === 'number'
                                      ? String(draft.selectedSingleIndex)
                                      : ''
                                  }
                                  onValueChange={(value) => handleTeacherSingleOptionChange(item.assignmentId, Number(value))}
                                >
                                  {item.options.map((option, index) => (
                                    <label
                                      key={`${item.assignmentId}-${index}`}
                                      htmlFor={`teacher-${item.assignmentId}-option-${index}`}
                                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
                                    >
                                      <RadioGroupItem
                                        id={`teacher-${item.assignmentId}-option-${index}`}
                                        value={String(index)}
                                      />
                                      <div>
                                        <span className="mr-2 font-medium">{ASSIGNMENT_OPTION_ORDER[index] || `${index + 1}`}</span>
                                        <span className="text-muted-foreground">{option}</span>
                                      </div>
                                    </label>
                                  ))}
                                </RadioGroup>
                              )}
                            </div>
                          )}

                          {item.questionType === 'blank' && (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">作答（共 {blankCount} 空）</p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {Array.from({ length: blankCount }, (_, index) => (
                                  <Input
                                    key={`${item.assignmentId}-blank-${index}`}
                                    value={draft.blankAnswers[index] || ''}
                                    onChange={(event) =>
                                      handleTeacherBlankAnswerChange(item.assignmentId, index, event.target.value)
                                    }
                                    placeholder={`第 ${index + 1} 空答案`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {item.questionType === 'essay' && (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">作答</p>
                              <Textarea
                                value={draft.essayAnswer}
                                onChange={(event) => handleTeacherEssayAnswerChange(item.assignmentId, event.target.value)}
                                placeholder="请输入你的答案"
                                rows={4}
                              />
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => submitTeacherAssignment(item)}
                              disabled={isSubmittingAssignment || !studentUserId}
                            >
                              {isSubmittingAssignment ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  提交中...
                                </>
                              ) : (
                                '提交作答'
                              )}
                            </Button>
                            {submitState && (
                              <p className={`text-xs ${submitState.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
                                {submitState.message}
                                {submitState.submittedAt ? `（${formatDateTime(submitState.submittedAt)}）` : ''}
                              </p>
                            )}
                          </div>

                          {item.note && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">备注</p>
                              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">{item.note}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">出题方式</CardTitle>
            <CardDescription>选择单题策略后生成选择题，提交后会更新用户画像</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={strategy === 'weakest' ? 'default' : 'outline'}
              onClick={() => setStrategy('weakest')}
              disabled={isLoadingQuestion || isSubmitting}
            >
              补弱优先
            </Button>
            <Button
              type="button"
              variant={strategy === 'spaced' ? 'default' : 'outline'}
              onClick={() => setStrategy('spaced')}
              disabled={isLoadingQuestion || isSubmitting}
            >
              间隔重复
            </Button>
            <Button type="button" onClick={loadQuestion} disabled={isLoadingQuestion || isSubmitting}>
              {isLoadingQuestion ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                '生成单题'
              )}
            </Button>
            {question && (
              <>
                <Badge variant="secondary">策略：{STRATEGY_LABEL[strategy]}</Badge>
                <Badge variant="outline">{zpdApplied ? '已应用ZPD筛选' : '未应用ZPD筛选'}</Badge>
              </>
            )}
          </CardContent>
        </Card>

        {error && (
          <PageState
            variant="error"
            size="sm"
            className="border-0 bg-transparent"
            title="操作失败"
            description={error}
          />
        )}

        {!question && !isLoadingQuestion && !error && (
          <PageState
            variant="empty"
            size="sm"
            className="border-0 bg-transparent"
            title="暂无题目"
            description="请选择出题方式后点击“生成单题”"
          />
        )}

        {question && (
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">题目ID: {question.id}</Badge>
                <Badge variant="outline">题型: {question.type}</Badge>
                {question.knowledgePoints.map((point) => (
                  <Badge key={point} variant="secondary">{point}</Badge>
                ))}
              </div>
              <CardTitle className="text-lg leading-relaxed">{question.stem}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <RadioGroup
                value={selectedOption ?? ''}
                onValueChange={(value) => setSelectedOption(value as ChoiceOption)}
                disabled={isAnswered}
              >
                {visibleOptions.map((option) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = answerResult?.correctOption === option;
                  const isWrongChoice = isAnswered && isSelected && !isCorrect;
                  const className = isCorrect
                    ? 'border-emerald-500 bg-emerald-50'
                    : isWrongChoice
                      ? 'border-red-500 bg-red-50'
                      : 'border-border';

                  return (
                    <label
                      key={option}
                      htmlFor={`option-${option}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${className}`}
                    >
                      <RadioGroupItem id={`option-${option}`} value={option} />
                      <div className="space-y-1">
                        <p className="font-medium">{option}</p>
                        <p className="text-muted-foreground">{question.options[option]}</p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>

              <div className="flex flex-wrap gap-3">
                <Button onClick={submitAnswer} disabled={isSubmitting || !selectedOption || isAnswered}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    '提交答案'
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={loadQuestion} disabled={isLoadingQuestion || isSubmitting}>
                  再来一题
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {answerResult && (
          <Card className={answerResult.isCorrect ? 'border-emerald-500' : 'border-red-500'}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${answerResult.isCorrect ? 'text-emerald-700' : 'text-red-600'}`}>
                {answerResult.isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                {answerResult.isCorrect ? '回答正确' : '回答错误'}
              </CardTitle>
              <CardDescription>
                你的答案：{answerResult.selectedOption} · 正确答案：{answerResult.correctOption}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">画像掌握度更新</p>
              {Object.keys(answerResult.updatedKcMastery).length === 0 ? (
                <p className="text-sm text-muted-foreground">后端未返回知识点掌握度明细。</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(answerResult.updatedKcMastery).map(([name, score]) => (
                    <div key={name} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="ml-2 text-muted-foreground">{Number(score).toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              )}
              {answerResult.profileUpdateTime && (
                <p className="text-xs text-muted-foreground">更新时间：{answerResult.profileUpdateTime}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
