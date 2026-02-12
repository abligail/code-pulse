'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Filter,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderMeta,
  PageHeaderTitle,
} from '@/components/ui/page-header';
import { PageState } from '@/components/ui/page-state';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ClientIcon } from '@/components/client-icon';
import { getActiveUser, listUsers, type LocalUser } from '@/lib/auth/session';
import {
  fetchTeacherAssignments,
  sendTeacherAssignment,
  type TeacherAssignmentQuestionType,
} from '@/lib/api/events';
import { fetchTeacherRequirements } from '@/lib/api/teacher';
import type { TeacherRequirementDTO, UserEventDTO } from '@/lib/api/types';

interface AssignmentDraft {
  assignmentId: string;
  title: string;
  stem: string;
  questionType: TeacherAssignmentQuestionType;
  options: string[];
  blankCount: number;
  referenceAnswer: string;
  note: string;
  targetUserIds: string;
}

interface AssignmentHistoryRecord {
  eventId: string;
  userId: string;
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
  sentAt: string;
}

const DRAFT_STORAGE_PREFIX = 'teacher-requirements-draft';
const MAX_OPTIONS = 6;
const CLASS_ID_LABEL_MAP: Record<string, string> = {
  class1: '计算机1班',
  class2: '计算机2班',
  class3: '计算机3班',
};

const QUESTION_TYPE_LABEL: Record<TeacherAssignmentQuestionType, string> = {
  single: '选择题',
  blank: '填空题',
  essay: '简答题',
};

const priorityLabel = (priority?: number) => {
  if (!priority) return '普通';
  if (priority >= 5) return '最高';
  if (priority === 4) return '较高';
  if (priority === 3) return '中等';
  return '基础';
};

const priorityClass = (priority?: number) => {
  if (!priority) return 'bg-muted text-muted-foreground';
  if (priority >= 5) return 'bg-red-500 text-white';
  if (priority === 4) return 'bg-orange-500 text-white';
  if (priority === 3) return 'bg-yellow-500 text-white';
  return 'bg-green-500 text-white';
};

const createAssignmentId = () => {
  const timePart = Date.now().toString(36);
  const randPart = Math.random().toString(36).slice(2, 8);
  return `asg_${timePart}_${randPart}`;
};

const createInitialDraft = (): AssignmentDraft => ({
  assignmentId: createAssignmentId(),
  title: '',
  stem: '',
  questionType: 'single',
  options: ['', ''],
  blankCount: 1,
  referenceAnswer: '',
  note: '',
  targetUserIds: '',
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

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

const normalizeQuestionType = (value: unknown): TeacherAssignmentQuestionType => {
  if (value === 'single' || value === 'blank' || value === 'essay') {
    return value;
  }
  return 'single';
};

const parseTargetUserIds = (raw: string) =>
  Array.from(
    new Set(
      raw
        .split(/[\n,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

const normalizeClassKey = (value?: string | null) => (value || '').trim().toLowerCase();

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

const normalizeDraft = (value: unknown): AssignmentDraft => {
  const record = asRecord(value);
  const normalized = createInitialDraft();
  const options = asStringArray(record.options);
  const questionType = normalizeQuestionType(record.questionType);

  normalized.assignmentId = asString(record.assignmentId, normalized.assignmentId);
  normalized.title = asString(record.title);
  normalized.stem = asString(record.stem);
  normalized.questionType = questionType;
  normalized.options =
    options.length === 0
      ? ['', '']
      : options.length === 1
        ? [options[0], '']
        : options.slice(0, MAX_OPTIONS);
  normalized.blankCount = Math.max(1, Math.floor(asNumber(record.blankCount, 1)));
  normalized.referenceAnswer = asString(record.referenceAnswer);
  normalized.note = asString(record.note);
  normalized.targetUserIds = asString(record.targetUserIds);

  return normalized;
};

const toHistoryRecord = (event: UserEventDTO): AssignmentHistoryRecord | null => {
  const metrics = asRecord(event.metrics);
  const assignmentId = asString(metrics.assignmentId, asString(event.roundId));
  if (!assignmentId) return null;

  return {
    eventId: event.eventId,
    userId: event.userId,
    assignmentId,
    version: Math.max(1, Math.floor(asNumber(metrics.version, 1))),
    title: asString(metrics.title, '未命名题目'),
    stem: asString(metrics.stem),
    questionType: normalizeQuestionType(metrics.questionType),
    options: asStringArray(metrics.options),
    blankCount: Math.max(0, Math.floor(asNumber(metrics.blankCount, 0))),
    referenceAnswer: asString(metrics.referenceAnswer),
    note: asString(metrics.note),
    senderId: asString(metrics.senderId),
    sentAt: asString(metrics.sentAt, event.occurredAt),
  };
};

export default function TeacherRequirementsPage() {
  const [teacherUserId, setTeacherUserId] = useState('');
  const [teacherName, setTeacherName] = useState('教师');
  const [teacherClassName, setTeacherClassName] = useState('');
  const [localStudents, setLocalStudents] = useState<LocalUser[]>([]);

  const [draft, setDraft] = useState<AssignmentDraft>(() => createInitialDraft());
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const [records, setRecords] = useState<AssignmentHistoryRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const [requirementsData, setRequirementsData] = useState<TeacherRequirementDTO | null>(null);
  const [requirementsLoading, setRequirementsLoading] = useState(true);
  const [requirementsError, setRequirementsError] = useState<string | null>(null);
  const [classId, setClassId] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');

  const draftStorageKey = useMemo(
    () => `${DRAFT_STORAGE_PREFIX}/${teacherUserId || 'teacher_guest'}`,
    [teacherUserId]
  );

  const targetUserIdList = useMemo(() => parseTargetUserIds(draft.targetUserIds), [draft.targetUserIds]);

  const activeTargetClassName = useMemo(() => {
    const fromClassSelector = classId !== 'all' ? CLASS_ID_LABEL_MAP[classId] || '' : '';
    return (
      fromClassSelector
      || teacherClassName
      || requirementsData?.className
      || ''
    ).trim();
  }, [classId, requirementsData?.className, teacherClassName]);

  const autoSelectableStudents = useMemo(() => {
    const classKey = normalizeClassKey(activeTargetClassName);
    if (!classKey) return [] as LocalUser[];

    return localStudents
      .filter((user) => normalizeClassKey(user.className) === classKey)
      .slice()
      .sort((a, b) => a.userId.localeCompare(b.userId));
  }, [activeTargetClassName, localStudents]);

  const normalizedOptions = useMemo(
    () => draft.options.map((option) => option.trim()).filter(Boolean),
    [draft.options]
  );

  const latestVersionByAssignment = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((record) => {
      map.set(record.assignmentId, Math.max(map.get(record.assignmentId) || 0, record.version));
    });
    return map;
  }, [records]);

  const nextVersion = useMemo(() => {
    const assignmentId = draft.assignmentId.trim();
    if (!assignmentId) return 1;
    return (latestVersionByAssignment.get(assignmentId) || 0) + 1;
  }, [draft.assignmentId, latestVersionByAssignment]);

  const validationError = useMemo(() => {
    if (!draft.title.trim()) return '请填写题目标题。';
    if (!draft.stem.trim()) return '请填写题干。';
    if (draft.questionType === 'single' && normalizedOptions.length < 2) {
      return '选择题至少保留 2 个有效选项。';
    }
    if (draft.questionType === 'blank' && (!Number.isFinite(draft.blankCount) || draft.blankCount < 1)) {
      return '填空题空位数量必须大于等于 1。';
    }
    if (targetUserIdList.length === 0) return '请至少填写一个学生 userId。';
    return null;
  }, [draft.blankCount, draft.questionType, draft.stem, draft.title, normalizedOptions.length, targetUserIdList.length]);

  const requirementGroups = useMemo(() => {
    if (!requirementsData) return [] as string[];
    return Array.from(new Set(requirementsData.nodes.map((node) => node.groupName).filter(Boolean))) as string[];
  }, [requirementsData]);

  const filteredRequirementNodes = useMemo(() => {
    if (!requirementsData) return [];
    const list = requirementsData.nodes
      .filter((node) => (groupFilter === 'all' ? true : node.groupName === groupFilter))
      .slice();

    return list.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;

      const deadlineA = a.deadlineAt ? new Date(a.deadlineAt).getTime() : Number.POSITIVE_INFINITY;
      const deadlineB = b.deadlineAt ? new Date(b.deadlineAt).getTime() : Number.POSITIVE_INFINITY;
      if (deadlineA !== deadlineB) return deadlineA - deadlineB;

      const masteryDiff = (b.targetMastery || 0) - (a.targetMastery || 0);
      if (masteryDiff !== 0) return masteryDiff;

      return (a.nodeName || '').localeCompare(b.nodeName || '');
    });
  }, [groupFilter, requirementsData]);

  const loadRequirementPanel = useCallback(async () => {
    setRequirementsLoading(true);
    setRequirementsError(null);
    try {
      const res = await fetchTeacherRequirements(classId);
      setRequirementsData(res);
    } catch (error) {
      console.error('Failed to fetch teacher requirements:', error);
      setRequirementsData(null);
      setRequirementsError('教学要求加载失败，请稍后重试。');
    } finally {
      setRequirementsLoading(false);
    }
  }, [classId]);

  const loadRecords = useCallback(async () => {
    if (!teacherUserId) return;
    setRecordsLoading(true);
    setRecordsError(null);

    try {
      const response = await fetchTeacherAssignments({ limit: 300, includeAll: true });
      const list = (response.events || [])
        .map(toHistoryRecord)
        .filter((item): item is AssignmentHistoryRecord => Boolean(item))
        .filter((item) => item.senderId === teacherUserId)
        .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      setRecords(list);
    } catch (error) {
      console.error('Failed to fetch teacher assignment records:', error);
      setRecords([]);
      setRecordsError('下发记录加载失败，请稍后重试。');
    } finally {
      setRecordsLoading(false);
    }
  }, [teacherUserId]);

  useEffect(() => {
    const activeUser = getActiveUser();
    setTeacherUserId(activeUser?.userId || 'teacher_guest');
    setTeacherName(activeUser?.name || '教师');
    setTeacherClassName(activeUser?.className || '');
  }, []);

  useEffect(() => {
    setLocalStudents(listUsers().filter((user) => user.role === 'student'));
  }, [teacherUserId]);

  useEffect(() => {
    if (!teacherUserId || typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) {
        setDraft(createInitialDraft());
      } else {
        const parsed = JSON.parse(raw) as unknown;
        setDraft(normalizeDraft(parsed));
      }
    } catch (error) {
      console.warn('Failed to read teacher requirements draft cache', error);
      setDraft(createInitialDraft());
    } finally {
      setIsDraftReady(true);
    }
  }, [draftStorageKey, teacherUserId]);

  useEffect(() => {
    if (!teacherUserId || !isDraftReady || typeof window === 'undefined') return;
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [draft, draftStorageKey, isDraftReady, teacherUserId]);

  useEffect(() => {
    void loadRequirementPanel();
  }, [loadRequirementPanel]);

  useEffect(() => {
    if (!teacherUserId) return;
    void loadRecords();
  }, [loadRecords, teacherUserId]);

  useEffect(() => {
    if (groupFilter === 'all') return;
    if (!requirementGroups.includes(groupFilter)) {
      setGroupFilter('all');
    }
  }, [groupFilter, requirementGroups]);

  const updateDraftField = <K extends keyof AssignmentDraft>(field: K, value: AssignmentDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuestionTypeChange = (value: string) => {
    const nextType = normalizeQuestionType(value);
    setDraft((prev) => {
      let options = prev.options;
      if (nextType === 'single') {
        options = prev.options.length >= 2 ? prev.options : [prev.options[0] || '', ''];
      }
      return {
        ...prev,
        questionType: nextType,
        options,
      };
    });
  };

  const handleOptionChange = (index: number, value: string) => {
    setDraft((prev) => ({
      ...prev,
      options: prev.options.map((item, idx) => (idx === index ? value : item)),
    }));
  };

  const addOption = () => {
    setDraft((prev) => {
      if (prev.options.length >= MAX_OPTIONS) return prev;
      return { ...prev, options: [...prev.options, ''] };
    });
  };

  const removeOption = (index: number) => {
    setDraft((prev) => {
      if (prev.options.length <= 2) return prev;
      return {
        ...prev,
        options: prev.options.filter((_, idx) => idx !== index),
      };
    });
  };

  const resetDraft = () => {
    setDraft(createInitialDraft());
    setSendResult(null);
  };

  const loadRecordToEditor = (record: AssignmentHistoryRecord) => {
    setDraft({
      assignmentId: record.assignmentId,
      title: record.title,
      stem: record.stem,
      questionType: record.questionType,
      options:
        record.options.length === 0
          ? ['', '']
          : record.options.length === 1
            ? [record.options[0], '']
            : record.options.slice(0, MAX_OPTIONS),
      blankCount: Math.max(1, record.blankCount || 1),
      referenceAnswer: record.referenceAnswer,
      note: record.note,
      targetUserIds: record.userId,
    });

    setSendResult({
      type: 'success',
      message: `已载入 ${record.assignmentId} 的 v${record.version}。再次发送将自动生成 v${record.version + 1}。`,
    });
  };

  const autoFillTargetsByClass = () => {
    if (!activeTargetClassName) {
      setSendResult({
        type: 'warning',
        message: '未识别当前班级，请先设置教师班级或选择班级后再自动填充。',
      });
      return;
    }

    if (autoSelectableStudents.length === 0) {
      setSendResult({
        type: 'warning',
        message: `未找到班级“${activeTargetClassName}”的本地学生账号，请先在当前浏览器登录学生账号。`,
      });
      return;
    }

    setDraft((prev) => ({
      ...prev,
      targetUserIds: autoSelectableStudents.map((user) => user.userId).join(', '),
    }));
    setSendResult({
      type: 'success',
      message: `已自动填充班级“${activeTargetClassName}”学生 ${autoSelectableStudents.length} 人。`,
    });
  };

  const handleSendAssignment = async () => {
    if (validationError) {
      setSendResult({ type: 'error', message: validationError });
      return;
    }

    const assignmentId = draft.assignmentId.trim() || createAssignmentId();
    const version = (latestVersionByAssignment.get(assignmentId) || 0) + 1;
    const sentAt = new Date().toISOString();

    setIsSending(true);
    setSendResult(null);

    const sendTasks = targetUserIdList.map((targetUserId) =>
      sendTeacherAssignment({
        targetUserId,
        assignmentId,
        version,
        title: draft.title,
        stem: draft.stem,
        questionType: draft.questionType,
        options: draft.questionType === 'single' ? normalizedOptions : [],
        blankCount: draft.questionType === 'blank' ? Math.max(1, Math.floor(draft.blankCount)) : 0,
        referenceAnswer: draft.referenceAnswer,
        note: draft.note,
        senderId: teacherUserId,
        senderName: teacherName,
        className: teacherClassName || requirementsData?.className || '',
        sentAt,
      })
    );

    const results = await Promise.allSettled(sendTasks);
    const successCount = results.filter((item) => item.status === 'fulfilled').length;
    const failedUserIds = results
      .map((item, index) => (item.status === 'rejected' ? targetUserIdList[index] : null))
      .filter((item): item is string => Boolean(item));

    if (successCount > 0) {
      setDraft((prev) => ({
        ...prev,
        assignmentId,
        targetUserIds: '',
      }));
      await loadRecords();
    }

    if (successCount === targetUserIdList.length) {
      setSendResult({
        type: 'success',
        message: `下发成功：${successCount} 名学生，题目版本 v${version}。`,
      });
    } else if (successCount > 0) {
      setSendResult({
        type: 'warning',
        message: `部分成功：${successCount}/${targetUserIdList.length} 名学生已下发，失败：${failedUserIds.join('、')}。`,
      });
    } else {
      setSendResult({
        type: 'error',
        message: `下发失败，请重试。失败目标：${failedUserIds.join('、') || '未知'}`,
      });
    }

    setIsSending(false);
  };

  const sendResultClassName =
    sendResult?.type === 'success'
      ? 'text-emerald-600'
      : sendResult?.type === 'warning'
        ? 'text-amber-600'
        : 'text-destructive';

  return (
    <div className="h-[calc(100vh-73px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageHeaderTitle>教学要求与题目下发</PageHeaderTitle>
            <PageHeaderDescription>
              在当前页面完成题目编辑、下发与重发（MVP 单题模式）。
            </PageHeaderDescription>
          </PageHeaderHeading>
          <PageHeaderActions>
            <PageHeaderMeta>
              <Badge variant="secondary">教师：{teacherName}</Badge>
              <Badge variant="outline">ID: {teacherUserId || '-'}</Badge>
              <Badge variant="outline">班级：{teacherClassName || '未绑定班级'}</Badge>
            </PageHeaderMeta>
            <Button variant="outline" onClick={loadRecords} disabled={recordsLoading || isSending}>
              <ClientIcon icon={RefreshCw} className="mr-2 h-4 w-4" />
              刷新记录
            </Button>
          </PageHeaderActions>
        </PageHeader>

        <Card>
          <CardHeader>
            <CardTitle>题目编辑器</CardTitle>
            <CardDescription>支持题型：选择题、填空题、简答题。发送时按 assignmentId 自动递增版本号。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="assignment-id">assignmentId（可编辑）</Label>
                  <Input
                    id="assignment-id"
                    value={draft.assignmentId}
                    onChange={(event) => updateDraftField('assignmentId', event.target.value)}
                    placeholder="留空将自动生成"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="question-type">题型</Label>
                  <Select value={draft.questionType} onValueChange={handleQuestionTypeChange}>
                    <SelectTrigger id="question-type">
                      <SelectValue placeholder="选择题型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">选择题</SelectItem>
                      <SelectItem value="blank">填空题</SelectItem>
                      <SelectItem value="essay">简答题</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignment-title">题目标题</Label>
                <Input
                  id="assignment-title"
                  value={draft.title}
                  onChange={(event) => updateDraftField('title', event.target.value)}
                  placeholder="例如：数组边界检查"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignment-stem">题干</Label>
                <Textarea
                  id="assignment-stem"
                  value={draft.stem}
                  onChange={(event) => updateDraftField('stem', event.target.value)}
                  placeholder="请输入完整题干"
                  rows={6}
                />
              </div>

              {draft.questionType === 'single' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>选项</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addOption}
                      disabled={draft.options.length >= MAX_OPTIONS}
                    >
                      <ClientIcon icon={Plus} className="mr-2 h-3.5 w-3.5" />
                      添加选项
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {draft.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(event) => handleOptionChange(index, event.target.value)}
                          placeholder={`选项 ${String.fromCharCode(65 + index)}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeOption(index)}
                          disabled={draft.options.length <= 2}
                        >
                          删除
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {draft.questionType === 'blank' && (
                <div className="space-y-2">
                  <Label htmlFor="blank-count">空位数量</Label>
                  <Input
                    id="blank-count"
                    type="number"
                    min={1}
                    value={draft.blankCount}
                    onChange={(event) => updateDraftField('blankCount', Math.max(1, Number(event.target.value) || 1))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reference-answer">参考答案</Label>
                <Textarea
                  id="reference-answer"
                  value={draft.referenceAnswer}
                  onChange={(event) => updateDraftField('referenceAnswer', event.target.value)}
                  placeholder="可选"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignment-note">备注</Label>
                <Textarea
                  id="assignment-note"
                  value={draft.note}
                  onChange={(event) => updateDraftField('note', event.target.value)}
                  placeholder="可选，例如：课堂重点"
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border/70 bg-muted/30 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="target-user-ids">发送目标（学生 userId，逗号/换行分隔）</Label>
                  <Button type="button" variant="outline" size="sm" onClick={autoFillTargetsByClass} disabled={isSending}>
                    自动填充班级学生
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  当前班级：{activeTargetClassName || '未识别'} · 可自动匹配 {autoSelectableStudents.length} 人
                </p>
                <Textarea
                  id="target-user-ids"
                  value={draft.targetUserIds}
                  onChange={(event) => updateDraftField('targetUserIds', event.target.value)}
                  placeholder="例如：u_student_01, u_student_02"
                  rows={8}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">目标学生 {targetUserIdList.length} 人</Badge>
                <Badge variant="outline">下次发送版本 v{nextVersion}</Badge>
                <Badge variant="outline">题型：{QUESTION_TYPE_LABEL[draft.questionType]}</Badge>
              </div>

              {validationError && (
                <p className="text-sm text-destructive">{validationError}</p>
              )}

              {sendResult && (
                <p className={`text-sm ${sendResultClassName}`}>{sendResult.message}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleSendAssignment}
                  disabled={isSending || !isDraftReady}
                  className="min-w-28"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      发送中...
                    </>
                  ) : (
                    <>
                      <ClientIcon icon={Send} className="mr-2 h-4 w-4" />
                      发送题目
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetDraft} disabled={isSending}>
                  新建题目
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>下发记录</CardTitle>
            <CardDescription>最近下发记录（按发送时间倒序），可直接载入编辑器重发。</CardDescription>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <PageState variant="loading" size="sm" className="border-0 bg-transparent" />
            ) : recordsError ? (
              <PageState
                variant="error"
                size="sm"
                title="下发记录加载失败"
                description={recordsError}
                action={(
                  <Button variant="outline" onClick={loadRecords}>
                    重试
                  </Button>
                )}
                className="border-0 bg-transparent"
              />
            ) : records.length === 0 ? (
              <PageState
                variant="empty"
                size="sm"
                title="暂无下发记录"
                description="发送第一道题后，这里会展示历史记录。"
                className="border-0 bg-transparent"
              />
            ) : (
              <div className="space-y-3">
                {records.slice(0, 30).map((record) => (
                  <div key={record.eventId} className="rounded-xl border border-border/70 bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{record.title}</p>
                        <p className="text-xs text-muted-foreground">
                          assignmentId: {record.assignmentId} · 目标学生: {record.userId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          发送时间：{formatDateTime(record.sentAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">v{record.version}</Badge>
                        <Badge variant="secondary">{QUESTION_TYPE_LABEL[record.questionType]}</Badge>
                        <Button type="button" variant="outline" size="sm" onClick={() => loadRecordToEditor(record)}>
                          载入并重发
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>教学要求展示（原模块）</CardTitle>
            <CardDescription>
              {requirementsData?.className || '未绑定班级'} · 共 {requirementsData?.nodes.length || 0} 个节点
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="选择班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">默认班级</SelectItem>
                  <SelectItem value="class1">计算机1班</SelectItem>
                  <SelectItem value="class2">计算机2班</SelectItem>
                  <SelectItem value="class3">计算机3班</SelectItem>
                </SelectContent>
              </Select>

              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="筛选模块" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部模块</SelectItem>
                  {requirementGroups.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={loadRequirementPanel}>
                <ClientIcon icon={RefreshCw} className="mr-2 h-4 w-4" />
                刷新教学要求
              </Button>
            </div>

            {requirementsLoading ? (
              <PageState variant="loading" size="sm" className="border-0 bg-transparent" />
            ) : requirementsError ? (
              <PageState
                variant="error"
                size="sm"
                title="教学要求加载失败"
                description={requirementsError}
                action={(
                  <Button variant="outline" onClick={loadRequirementPanel}>
                    重试
                  </Button>
                )}
                className="border-0 bg-transparent"
              />
            ) : filteredRequirementNodes.length === 0 ? (
              <PageState
                variant="empty"
                size="sm"
                title="暂无教学节点"
                description="当前筛选条件下没有可展示的节点。"
                className="border-0 bg-transparent"
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredRequirementNodes.map((node) => (
                  <Card key={node.nodeId} className="shadow-sm">
                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{node.nodeName || '未命名知识点'}</CardTitle>
                          <CardDescription>{node.nodeType || '未分类'}</CardDescription>
                        </div>
                        <Badge className={priorityClass(node.priority)}>{priorityLabel(node.priority)}</Badge>
                      </div>
                      {node.groupName && (
                        <Badge variant="outline" className="w-fit text-xs">
                          {node.groupName}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <ClientIcon icon={Target} className="h-4 w-4 text-primary" />
                            目标掌握度
                          </span>
                          <span>{node.targetMastery}/5</span>
                        </div>
                        <Progress value={(node.targetMastery || 0) * 20} className="h-2" />
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {node.minChatRounds !== undefined && (
                          <span className="flex items-center gap-1">
                            <ClientIcon icon={Layers} className="h-3 w-3" />
                            至少 {node.minChatRounds} 轮问答
                          </span>
                        )}
                        {node.minPracticeCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <ClientIcon icon={Filter} className="h-3 w-3" />
                            至少 {node.minPracticeCount} 次练习
                          </span>
                        )}
                      </div>

                      {node.deadlineAt && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <ClientIcon icon={CalendarDays} className="h-3 w-3" />
                          截止时间 {node.deadlineAt}
                        </div>
                      )}

                      {node.tags && node.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {node.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {node.note && (
                        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                          {node.note}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
