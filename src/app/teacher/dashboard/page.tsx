'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, Users, CheckCircle2, MessageSquare, TrendingUp, RefreshCw, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderFilters, PageHeaderHeading, PageHeaderTitle } from '@/components/ui/page-header';
import { PageState } from '@/components/ui/page-state';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClientIcon } from '@/components/client-icon';
import {
  fetchTeacherDashboard,
  fetchAllUserProfiles,
  type DashboardData,
  type UserProfileRecordDTO,
  type WeakKnowledgePointDTO,
} from '@/lib/api/teacher';
import { fetchUserBasics, type BasicUserDTO } from '@/lib/api/users';

const CATEGORY_COLORS = ['#38bdf8', '#10b981', '#facc15', '#f472b6', '#a78bfa', '#fb923c'];
const WORD_CLOUD_WIDTH = 420;
const WORD_CLOUD_HEIGHT = 260;
const WORD_CLOUD_COLORS = ['#f9a8d4', '#fde68a', '#bef264', '#93c5fd', '#c4b5fd', '#fcd34d'];
type EnrichedWeakPoint = WeakKnowledgePointDTO & { userId: string; userName?: string };

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [profileUsers, setProfileUsers] = useState<UserProfileRecordDTO[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfileRecordDTO | null>(null);
  const [userBasics, setUserBasics] = useState<Record<string, BasicUserDTO>>({});

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dashboardData = await fetchTeacherDashboard(classId, timeRange);
      setData(dashboardData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setData(null);
      setError('班级看板加载失败，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  }, [classId, timeRange]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const loadUserProfiles = useCallback(async () => {
    setProfilesLoading(true);
    setProfilesError(null);
    try {
      const response = await fetchAllUserProfiles({ onlyWeak: true });
      const users = response.users || [];
      setProfileUsers(users);

      const ids = Array.from(new Set(users.map((u) => u.user_id).filter((id): id is string => Boolean(id))));
      if (ids.length > 0) {
        try {
          const basics = await fetchUserBasics(ids);
          const map: Record<string, BasicUserDTO> = {};
          (basics.users || []).forEach((item) => {
            if (item.userId) {
              map[item.userId] = item;
            }
          });
          setUserBasics(map);
        } catch (error) {
          console.error('Failed to fetch user basics:', error);
        }
      } else {
        setUserBasics({});
      }
    } catch (error) {
      console.error('Failed to fetch user profiles:', error);
      setProfileUsers([]);
      setUserBasics({});
      setProfilesError('学生画像数据获取失败，请稍后重试。');
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUserProfiles();
  }, [loadUserProfiles]);

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

  const formatWeakScore = (value?: number | string | null) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
    if (value === null || value === undefined) return '—';
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toString() : String(value);
  };

  const resolveUserName = useCallback(
    (user: UserProfileRecordDTO) => userBasics[user.user_id]?.name || user.user_name || '未命名学生',
    [userBasics]
  );

  const enrichedWeakPoints = useMemo<EnrichedWeakPoint[]>(() => {
    return profileUsers.flatMap((user) => {
      const displayName = userBasics[user.user_id]?.name || user.user_name;
      return (user.weak_knowledge ?? []).map((point) => ({
        ...point,
        userId: user.user_id,
        userName: displayName,
      }));
    });
  }, [profileUsers, userBasics]);

  const totalWeakPoints = enrichedWeakPoints.length;
  const averageWeakPerUser = profileUsers.length > 0 ? (totalWeakPoints / profileUsers.length).toFixed(1) : '0.0';

  const topWeakKnowledge = useMemo(
    () => {
      const stats = new Map<string, { count: number; totalScore: number; sampleReason?: string }>();
      enrichedWeakPoints.forEach((point) => {
        const name = point.knowledge_name || '未命名知识点';
        const prev = stats.get(name) || { count: 0, totalScore: 0, sampleReason: point.weak_reason };
        const score = typeof point.weak_score === 'number' ? point.weak_score : Number(point.weak_score);
        const numericScore = Number.isFinite(score) ? score : 0;
        stats.set(name, {
          count: prev.count + 1,
          totalScore: prev.totalScore + numericScore,
          sampleReason: prev.sampleReason || point.weak_reason,
        });
      });
      return Array.from(stats.entries())
        .map(([name, info]) => ({
          name,
          count: info.count,
          avgScore: info.count ? Number((info.totalScore / info.count).toFixed(1)) : null,
          sampleReason: info.sampleReason,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    },
    [enrichedWeakPoints]
  );

  const categoryDistribution = useMemo(
    () => {
      const counts = new Map<string, number>();
      enrichedWeakPoints.forEach((point) => {
        const categories =
          point.knowledge_category && point.knowledge_category.length > 0
            ? point.knowledge_category
            : ['未分类'];
        categories.forEach((category) => {
          counts.set(category, (counts.get(category) || 0) + 1);
        });
      });
      return Array.from(counts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    },
    [enrichedWeakPoints]
  );

  const categoryPieSegments = useMemo(() => {
    if (categoryDistribution.length === 0 || totalWeakPoints === 0) return '';
    let current = 0;
    const segments: string[] = [];
    categoryDistribution.forEach((item, idx) => {
      const percent = (item.count / totalWeakPoints) * 100;
      const start = current;
      const end = current + percent;
      const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
      segments.push(`${color} ${start}% ${end}%`);
      current = end;
    });
    return segments.join(', ');
  }, [categoryDistribution, totalWeakPoints]);

  const categoryPieBackground = categoryPieSegments
    ? `conic-gradient(${categoryPieSegments})`
    : 'conic-gradient(#cbd5f5 0deg, #cbd5f5 360deg)';

  const wordCloud = useMemo(() => {
    const counts = new Map<string, number>();
    enrichedWeakPoints.forEach((point) => {
      const key = point.knowledge_name || '未命名知识点';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([word, weight]) => ({ word, weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 20);
  }, [enrichedWeakPoints]);

  const maxWordWeight = wordCloud[0]?.weight ?? 0;

  const cloudLayout = useMemo(() => {
    if (wordCloud.length === 0)
      return [] as Array<{
        word: string;
        weight: number;
        fontSize: number;
        opacity: number;
        left: number;
        top: number;
        color: string;
      }>;

    const placements: Array<{
      word: string;
      weight: number;
      fontSize: number;
      opacity: number;
      left: number;
      top: number;
      color: string;
    }> = [];
    const boxes: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];
    const approxSize = (word: string, fontSize: number) => {
      const width = Math.max(fontSize * word.length * 0.55, fontSize * 1.6);
      const height = fontSize * 1.25;
      return { width, height };
    };
    const overlaps = (x: number, y: number, width: number, height: number) =>
      boxes.some((box) =>
        !(x + width / 2 < box.x1 || x - width / 2 > box.x2 || y + height / 2 < box.y1 || y - height / 2 > box.y2)
      );
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    wordCloud.forEach((item, idx) => {
      const ratio = maxWordWeight ? item.weight / maxWordWeight : 0.5;
      const fontSize = 16 + ratio * 22;
      const opacity = 0.65 + ratio * 0.35;
      const color = WORD_CLOUD_COLORS[idx % WORD_CLOUD_COLORS.length];
      let placed = false;

      for (let attempt = 0; attempt < 220; attempt += 1) {
        const angle = attempt * goldenAngle;
        const radius = 10 + Math.sqrt(attempt + 1) * 15;
        const x = WORD_CLOUD_WIDTH / 2 + Math.cos(angle) * radius * (1 + ratio * 0.4);
        const y = WORD_CLOUD_HEIGHT / 2 + Math.sin(angle) * radius * 0.8;
        const { width, height } = approxSize(item.word, fontSize);

        if (
          x - width / 2 < 0 ||
          x + width / 2 > WORD_CLOUD_WIDTH ||
          y - height / 2 < 0 ||
          y + height / 2 > WORD_CLOUD_HEIGHT ||
          overlaps(x, y, width, height)
        ) {
          continue;
        }

        boxes.push({
          x1: x - width / 2 - 6,
          x2: x + width / 2 + 6,
          y1: y - height / 2 - 6,
          y2: y + height / 2 + 6,
        });

        placements.push({
          word: item.word,
          weight: item.weight,
          fontSize,
          opacity,
          color,
          left: (x / WORD_CLOUD_WIDTH) * 100,
          top: (y / WORD_CLOUD_HEIGHT) * 100,
        });
        placed = true;
        break;
      }

      if (!placed) {
        placements.push({
          word: item.word,
          weight: item.weight,
          fontSize,
          opacity,
          color,
          left: 30 + Math.random() * 40,
          top: 30 + Math.random() * 40,
        });
      }
    });

    return placements;
  }, [wordCloud, maxWordWeight]);

  const userRanking = useMemo(() => {
    return profileUsers
      .map((user) => {
        const list = user.weak_knowledge ?? [];
        const weakCount = list.length;
        const totalScore = list.reduce((sum, item) => {
          const value = typeof item.weak_score === 'number' ? item.weak_score : Number(item.weak_score);
          return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
        const avgWeakScore = weakCount ? Number((totalScore / weakCount).toFixed(1)) : null;
        return {
          user,
          weakCount,
          avgWeakScore,
          displayName: resolveUserName(user),
        };
      })
      .sort((a, b) => {
        if (b.weakCount !== a.weakCount) return b.weakCount - a.weakCount;
        return (b.avgWeakScore ?? 0) - (a.avgWeakScore ?? 0);
      })
      .slice(0, 8);
  }, [profileUsers, resolveUserName]);

  const latestProfileUpdate = useMemo(() => {
    const timestamps = profileUsers
      .map((user) => user.profile_update_time)
      .filter((value): value is string => Boolean(value));
    if (timestamps.length === 0) return null;
    const latest = timestamps.reduce((max, current) =>
      new Date(current).getTime() > new Date(max).getTime() ? current : max
    );
    return latest ? new Date(latest) : null;
  }, [profileUsers]);

  const latestProfileUpdateLabel = latestProfileUpdate
    ? latestProfileUpdate.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const handleSelectProfile = (profile: UserProfileRecordDTO) => {
    setSelectedProfile(profile);
    setProfileDialogOpen(true);
  };

  const keywordCloud = useMemo(() => {
    if (!data?.clusters) return [] as Array<{ word: string; weight: number }>;
    const weights: Record<string, number> = {};
    data.clusters.forEach(cluster => {
      cluster.topKeywords.forEach(keyword => {
        weights[keyword] = (weights[keyword] || 0) + cluster.count;
      });
    });
    return Object.entries(weights)
      .map(([word, weight]) => ({ word, weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 16);
  }, [data?.clusters]);

  const handleExportCSV = () => {
    if (!data) return;

    const csvContent = [
      ['姓名', '提问次数/周', '练习正确率', '薄弱知识点'].join(','),
      ...data.students.map(s => 
        [s.name, s.questionsPerWeek, s.practiceAccuracy, s.weak.join(';')].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '班级学情报告.csv';
    link.click();
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
          title="班级看板加载失败"
          description={error}
          action={(
            <Button variant="outline" onClick={fetchDashboardData}>
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
            <PageHeaderTitle>班级看板</PageHeaderTitle>
            <PageHeaderDescription>掌握班级整体学习趋势与核心问题分布</PageHeaderDescription>
          </PageHeaderHeading>
          <PageHeaderActions>
            <Button variant="outline" onClick={fetchDashboardData}>
              <ClientIcon icon={RefreshCw} className="w-4 h-4 mr-2" />
              刷新
            </Button>
            <Button onClick={handleExportCSV}>
              <ClientIcon icon={Download} className="w-4 h-4 mr-2" />
              导出CSV
            </Button>
          </PageHeaderActions>
        </PageHeader>

        <PageHeaderFilters>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="选择班级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部班级</SelectItem>
              <SelectItem value="class1">计算机1班</SelectItem>
              <SelectItem value="class2">计算机2班</SelectItem>
              <SelectItem value="class3">计算机3班</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="选择时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部时间</SelectItem>
              <SelectItem value="week">本周</SelectItem>
              <SelectItem value="month">本月</SelectItem>
              <SelectItem value="semester">本学期</SelectItem>
            </SelectContent>
          </Select>
        </PageHeaderFilters>

        {data && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">练习完成率</CardTitle>
                  <ClientIcon icon={CheckCircle2} className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.completionRate[0]?.rate || 0}%</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ClientIcon icon={TrendingUp} className="w-3 h-3" />
                    <span>
                      {data.completionRate[1] && (
                        <>较上周 {data.completionRate[0].rate - data.completionRate[1].rate > 0 ? '+' : ''}
                        {data.completionRate[1] ? data.completionRate[0].rate - data.completionRate[1].rate : 0}%
                        </>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">平均正确率</CardTitle>
                  <ClientIcon icon={Users} className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.students.length > 0
                      ? Math.round(data.students.reduce((acc, s) => acc + s.practiceAccuracy, 0) / data.students.length)
                      : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    基于 {data.students.length} 名学生
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">提问次数/周</CardTitle>
                  <ClientIcon icon={MessageSquare} className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.students.length > 0
                      ? Math.round(data.students.reduce((acc, s) => acc + s.questionsPerWeek, 0) / data.students.length)
                      : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    班级平均
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>常见错误 Top 5</CardTitle>
                  <CardDescription>最近出现的错误类型统计</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.errorTop.slice(0, 5).map((error, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{error.type}</span>
                            <span className="text-sm text-muted-foreground">{error.count} 次</span>
                          </div>
                          <Progress 
                            value={(error.count / data.errorTop[0].count) * 100} 
                            className="h-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>薄弱知识点 Top 5</CardTitle>
                  <CardDescription>学生掌握度较低的知识领域</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.weakTop.slice(0, 5).map((weak, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{weak.name}</span>
                            <span className="text-sm text-muted-foreground">掌握度: {weak.score}%</span>
                          </div>
                          <Progress 
                            value={weak.score} 
                            className="h-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClientIcon icon={Cloud} className="w-4 h-4 text-primary" />
                  问题聚类 / 词云
                </CardTitle>
                <CardDescription>近期学生提问的主题聚合</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {data.clusters?.map(cluster => (
                    <Card key={cluster.clusterId} className="bg-muted/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{cluster.label}</CardTitle>
                        <CardDescription>{cluster.count} 次提及</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        {cluster.topKeywords.map(keyword => (
                          <Badge key={keyword} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {keywordCloud.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {keywordCloud.map(item => (
                      <span
                        key={item.word}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs"
                        style={{ fontSize: `${Math.min(14 + item.weight / 8, 22)}px` }}
                      >
                        {item.word}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>学生列表</CardTitle>
                <CardDescription>班级学生学情详情</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>姓名</TableHead>
                        <TableHead className="text-center">提问次数/周</TableHead>
                        <TableHead className="text-center">练习正确率</TableHead>
                        <TableHead>薄弱知识点</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell className="text-center">
                            {student.questionsPerWeek}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={student.practiceAccuracy >= 80 ? 'default' : student.practiceAccuracy >= 60 ? 'secondary' : 'destructive'}
                              className={student.practiceAccuracy >= 80 ? 'bg-green-600' : ''}
                            >
                              {student.practiceAccuracy}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {student.weak.map((weak, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {weak}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>薄弱画像监控</CardTitle>
                  <CardDescription>实时串联 Mongo 学生画像，洞察全量薄弱知识点的分布走势</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void loadUserProfiles()} disabled={profilesLoading}>
                    <ClientIcon icon={RefreshCw} className="w-4 h-4 mr-2" />
                    刷新画像
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {profilesLoading ? (
                  <PageState
                    variant="loading"
                    size="sm"
                    className="border-0 bg-transparent"
                    description="正在汇总学生画像..."
                  />
                ) : profilesError ? (
                  <PageState
                    variant="error"
                    size="sm"
                    className="border-0 bg-transparent"
                    title="画像获取失败"
                    description={profilesError}
                    action={(
                      <Button variant="outline" size="sm" onClick={() => void loadUserProfiles()}>
                        重试
                      </Button>
                    )}
                  />
                ) : profileUsers.length === 0 ? (
                  <PageState
                    variant="empty"
                    size="sm"
                    className="border-0 bg-transparent"
                    title="暂无画像数据"
                    description="待学生完成薄弱点分析后自动呈现。"
                  />
                ) : (
                  <div className="space-y-8">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[{
                        label: '画像覆盖',
                        value: profileUsers.length,
                      }, {
                        label: '薄弱点总量',
                        value: totalWeakPoints,
                      }, {
                        label: '人均薄弱点',
                        value: averageWeakPerUser,
                      }, {
                        label: '最近画像更新',
                        value: latestProfileUpdateLabel,
                      }].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="mt-1 text-xl font-semibold text-foreground">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                      <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground">薄弱知识点 Top 6</h4>
                          <span className="text-xs text-muted-foreground">按出现次数排序</span>
                        </div>
                        {topWeakKnowledge.length === 0 ? (
                          <p className="mt-6 text-sm text-muted-foreground">暂无薄弱知识点统计。</p>
                        ) : (
                          <div className="mt-4 space-y-4">
                            {topWeakKnowledge.map((item, idx) => (
                              <div key={item.name} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium">{idx + 1}. {item.name}</span>
                                  <span className="text-xs text-muted-foreground">{item.count} 次</span>
                                </div>
                                <Progress
                                  value={(item.count / (topWeakKnowledge[0]?.count || 1)) * 100}
                                  className="h-2"
                                />
                                {item.sampleReason && (
                                  <p className="text-xs text-muted-foreground leading-relaxed">{item.sampleReason}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground">知识类别占比</h4>
                          <span className="text-xs text-muted-foreground">自动按标签聚合</span>
                        </div>
                        {categoryDistribution.length === 0 ? (
                          <p className="mt-6 text-sm text-muted-foreground">暂无分类信息。</p>
                        ) : (
                          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-center">
                            <div className="mx-auto h-40 w-40">
                              <div
                                className="relative h-full w-full rounded-full"
                                style={{ background: categoryPieBackground }}
                              >
                                <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-background/80 text-sm font-semibold">
                                  <span>总数</span>
                                  <span className="text-2xl">{totalWeakPoints}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 space-y-3 text-sm">
                              {categoryDistribution.map((item, idx) => (
                                <div key={item.category} className="flex items-center gap-2">
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                                  />
                                  <span className="flex-1">{item.category}</span>
                                  <span className="text-muted-foreground">{item.count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
                      <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground">学生预警榜</h4>
                          <span className="text-xs text-muted-foreground">薄弱点数量靠前</span>
                        </div>
                        {userRanking.length === 0 ? (
                          <p className="mt-6 text-sm text-muted-foreground">暂无需要预警的学生。</p>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {userRanking.map(({ user, weakCount, avgWeakScore, displayName }) => (
                              <div
                                key={user.user_id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                              >
                                <div>
                                  <p className="font-semibold">{displayName}</p>
                                  <p className="text-xs text-muted-foreground">{user.user_id}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-semibold">{weakCount}</p>
                                  <p className="text-xs text-muted-foreground">薄弱点</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">{avgWeakScore ?? '—'}</p>
                                  <p className="text-xs text-muted-foreground">平均衰减分</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground">薄弱点词云</h4>
                          <span className="text-xs text-muted-foreground">权重按出现频次</span>
                        </div>
                        {wordCloud.length === 0 ? (
                          <p className="mt-6 text-sm text-muted-foreground">暂无词云数据。</p>
                        ) : (
                          <div className="mt-4 flex items-center justify-center">
                            <div className="relative h-64 w-full max-w-2xl rounded-[32px] border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                              <div className="absolute inset-1 rounded-[28px] bg-[radial-gradient(circle_at_30%_30%,rgba(148,163,184,0.22),transparent_45%),radial-gradient(circle_at_75%_20%,rgba(59,130,246,0.25),transparent_55%)]" />
                              {cloudLayout.map((item) => (
                                <span
                                  key={`${item.word}-${item.left}-${item.top}`}
                                  className="absolute select-none font-semibold tracking-tight text-white drop-shadow-[0_3px_8px_rgba(2,6,23,0.45)]"
                                  style={{
                                    left: `${item.left}%`,
                                    top: `${item.top}%`,
                                    fontSize: `${item.fontSize}px`,
                                    color: item.color,
                                    opacity: item.opacity,
                                    transform: 'translate(-50%, -50%)',
                                  }}
                                >
                                  {item.word}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-foreground">画像列表</h4>
                        <span className="text-xs text-muted-foreground">点击学生 ID 查看薄弱点详情</span>
                      </div>
                      <ScrollArea className="mt-4 h-[320px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>学生</TableHead>
                              <TableHead className="text-center">薄弱点数量</TableHead>
                              <TableHead>最近更新</TableHead>
                              <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {profileUsers.map((profile) => {
                              const weakCount = profile.weak_knowledge?.length ?? 0;
                              return (
                                <TableRow key={profile.user_id}>
                                  <TableCell>
                                    <p className="font-medium">{resolveUserName(profile)}</p>
                                    <button
                                      className="text-xs text-primary underline-offset-2 hover:underline"
                                      onClick={() => handleSelectProfile(profile)}
                                    >
                                      {profile.user_id}
                                    </button>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge
                                      variant={weakCount >= 5 ? 'destructive' : weakCount >= 3 ? 'secondary' : 'default'}
                                    >
                                      {weakCount}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{formatDateTime(profile.profile_update_time)}</TableCell>
                                  <TableCell className="text-right">
                                    <Button size="sm" variant="outline" onClick={() => handleSelectProfile(profile)}>
                                      查看薄弱点
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>教学建议</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-sm">
                      <strong>重点关注：</strong>{data.weakTop[0]?.name} 是全班最薄弱的知识点，建议在下次课重点讲解
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-sm">
                      <strong>错误预防：</strong>{data.errorTop[0]?.type} 发生次数最多，建议加强相关练习
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-sm">
                      <strong>分层教学：</strong>根据学生掌握情况，可将学生分组进行针对性辅导
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-sm">
                      <strong>互动提升：</strong>鼓励学生在问答页多提问，及时解答疑惑
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      <Dialog
        open={profileDialogOpen}
        onOpenChange={(open) => {
          setProfileDialogOpen(open);
          if (!open) setSelectedProfile(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>学生薄弱点画像</DialogTitle>
            <DialogDescription>
              {selectedProfile
                ? `${resolveUserName(selectedProfile)} · ${selectedProfile.user_id}`
                : '未选择学生'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
            {(selectedProfile?.weak_knowledge ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无薄弱知识点。</p>
            ) : (
              (selectedProfile?.weak_knowledge ?? []).map((weak) => (
                <div
                  key={`${weak.knowledge_id}-${weak.knowledge_name}`}
                  className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{weak.knowledge_name || '未命名知识点'}</p>
                    <Badge variant="outline" className="text-xs">
                      衰减分 {formatWeakScore(weak.weak_score)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {weak.weak_reason || '暂无薄弱原因说明。'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {(weak.knowledge_category?.length ? weak.knowledge_category : ['未分类']).map((category) => (
                      <Badge key={`${weak.knowledge_id}-${category}`} variant="secondary" className="text-[11px]">
                        {category}
                      </Badge>
                    ))}
                  </div>
                  <dl className="mt-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-2 py-1">
                      <span>首次发现</span>
                      <span>{formatDateTime(weak.first_weak_time)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-2 py-1">
                      <span>上次复习</span>
                      <span>{formatDateTime(weak.last_review_time)}</span>
                    </div>
                  </dl>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
