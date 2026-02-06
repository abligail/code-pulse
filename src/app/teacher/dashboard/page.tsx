'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { ClientIcon } from '@/components/client-icon';
import { fetchTeacherDashboard, type DashboardData } from '@/lib/api/teacher';

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState('all');
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    fetchDashboardData();
  }, [classId, timeRange]);

  const fetchDashboardData = async () => {
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
    </div>
  );
}
