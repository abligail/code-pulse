'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Filter, Layers, RefreshCw, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderFilters, PageHeaderHeading, PageHeaderMeta, PageHeaderTitle } from '@/components/ui/page-header';
import { PageState } from '@/components/ui/page-state';
import { ClientIcon } from '@/components/client-icon';
import { fetchTeacherRequirements } from '@/lib/api/teacher';
import type { TeacherRequirementDTO } from '@/lib/api/types';

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

export default function TeacherRequirementsPage() {
  const [data, setData] = useState<TeacherRequirementDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');

  useEffect(() => {
    loadRequirements();
  }, [classId]);

  const loadRequirements = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchTeacherRequirements(classId);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch teacher requirements:', error);
      setData(null);
      setError('教学要求加载失败，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  const groups = useMemo(() => {
    if (!data) return [] as string[];
    return Array.from(new Set(data.nodes.map(node => node.groupName).filter(Boolean))) as string[];
  }, [data]);

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    const list = data.nodes
      .filter(node => (groupFilter === 'all' ? true : node.groupName === groupFilter))
      .slice();

    return list.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;

      const deadlineA = a.deadlineAt ? new Date(a.deadlineAt).getTime() : Number.POSITIVE_INFINITY;
      const deadlineB = b.deadlineAt ? new Date(b.deadlineAt).getTime() : Number.POSITIVE_INFINITY;
      if (deadlineA !== deadlineB) return deadlineA - deadlineB;

      const masteryDiff = (b.targetMastery || 0) - (a.targetMastery || 0);
      if (masteryDiff !== 0) return masteryDiff;

      const typeDiff = (a.nodeType || '').localeCompare(b.nodeType || '');
      if (typeDiff !== 0) return typeDiff;

      return (a.nodeName || '').localeCompare(b.nodeName || '');
    });
  }, [data, groupFilter]);

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
          title="教学要求加载失败"
          description={error}
          action={(
            <Button variant="outline" onClick={loadRequirements}>
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
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageHeaderTitle>教学要求展示面板</PageHeaderTitle>
            <PageHeaderDescription>
              {data?.className || '未绑定班级'} · 共 {data?.nodes.length || 0} 个节点
            </PageHeaderDescription>
          </PageHeaderHeading>
          <PageHeaderActions>
            <PageHeaderMeta>
              <Badge variant="secondary">更新时间 {data?.updatedAt || '-'}</Badge>
            </PageHeaderMeta>
            <Button variant="outline" onClick={loadRequirements}>
              <ClientIcon icon={RefreshCw} className="w-4 h-4 mr-2" />
              刷新
            </Button>
          </PageHeaderActions>
        </PageHeader>

        <PageHeaderFilters>
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
              {groups.map(group => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
              </SelectContent>
          </Select>
        </PageHeaderFilters>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredNodes.map(node => (
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
                      <ClientIcon icon={Target} className="w-4 h-4 text-primary" />
                      目标掌握度
                    </span>
                    <span>{node.targetMastery}/5</span>
                  </div>
                  <Progress value={(node.targetMastery || 0) * 20} className="h-2" />
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {node.minChatRounds !== undefined && (
                    <span className="flex items-center gap-1">
                      <ClientIcon icon={Layers} className="w-3 h-3" />
                      至少 {node.minChatRounds} 轮问答
                    </span>
                  )}
                  {node.minPracticeCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <ClientIcon icon={Filter} className="w-3 h-3" />
                      至少 {node.minPracticeCount} 次练习
                    </span>
                  )}
                </div>

                {node.deadlineAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ClientIcon icon={CalendarDays} className="w-3 h-3" />
                    截止时间 {node.deadlineAt}
                  </div>
                )}

                {node.tags && node.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {node.tags.map(tag => (
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
      </div>
    </div>
  );
}
