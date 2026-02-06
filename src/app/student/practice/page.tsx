'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Send, Loader2, CheckCircle2, XCircle, Clock, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderFilters, PageHeaderHeading, PageHeaderTitle } from '@/components/ui/page-header';
import { PageState } from '@/components/ui/page-state';
import { fetchPracticeDetail, fetchPracticeList, submitPractice, type PracticeDetail, type PracticeItem, type PracticeSource, type SubmitResult } from '@/lib/api/practice';
import { logUserEvent } from '@/lib/api/events';

export default function PracticePage() {
  const [selectedPractice, setSelectedPractice] = useState<PracticeItem | null>(null);
  const [practiceDetail, setPracticeDetail] = useState<PracticeDetail | null>(null);
  const [practiceList, setPracticeList] = useState<PracticeItem[]>([]);
  const [code, setCode] = useState('');
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filterTopic, setFilterTopic] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');

  useEffect(() => {
    loadPracticeList();
  }, [filterTopic, filterLevel]);

  const loadPracticeList = async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const data = await fetchPracticeList(filterTopic, filterLevel);
      setPracticeList(data.items || []);
    } catch (error) {
      console.error('Failed to fetch practice list:', error);
      setPracticeList([]);
      setListError('练习列表加载失败，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPracticeDetail = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await fetchPracticeDetail(id);
      setPracticeDetail(data);
      setCode('');
      setSubmitResult(null);
    } catch (error) {
      console.error('Failed to fetch practice detail:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePracticeSelect = (item: PracticeItem) => {
    setSelectedPractice(item);
    loadPracticeDetail(item.id);
  };

  const handleBack = () => {
    setSelectedPractice(null);
    setPracticeDetail(null);
    setSubmitResult(null);
  };

  const handleSubmit = async () => {
    if (!selectedPractice || !code.trim()) return;

    setIsSubmitting(true);
    try {
      const data = await submitPractice({ id: selectedPractice.id, code });
      setSubmitResult(data);

      void logUserEvent({
        eventType: 'practice_submit',
        source: 'student/practice',
        metrics: {
          practiceId: selectedPractice.id,
          status: data.status,
          score: data.score,
          topic: selectedPractice.topic,
          level: selectedPractice.level,
          sourceTag: selectedPractice.source,
        },
      });
    } catch (error) {
      console.error('Failed to submit practice:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case '入门': return 'bg-green-100 text-green-800';
      case '基础': return 'bg-blue-100 text-blue-800';
      case '提高': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done': return <Badge className="bg-green-600">已完成</Badge>;
      case 'in_progress': return <Badge variant="secondary">进行中</Badge>;
      default: return <Badge variant="outline">新题目</Badge>;
    }
  };

  const getSourceLabel = (source?: PracticeSource) => {
    switch (source) {
      case 'weak':
        return '薄弱点推荐';
      case 'teacher':
        return '教师要求';
      case 'review':
        return '复习队列';
      case 'system':
        return '系统推荐';
      default:
        return '';
    }
  };

  const getAdaptiveClass = (level?: string) => {
    switch (level) {
      case '入门':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case '基础':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case '提高':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const renderSourceBadge = (source?: PracticeSource) => {
    if (!source) return null;
    return (
      <Badge variant="secondary" className="text-xs">
        来源：{getSourceLabel(source)}
      </Badge>
    );
  };

  const renderAdaptiveBadge = (level?: string) => {
    if (!level) return null;
    return (
      <Badge variant="outline" className={`text-xs ${getAdaptiveClass(level)}`}>
        建议难度：{level}
      </Badge>
    );
  };

  if (!selectedPractice || !practiceDetail) {
    // List View
    return (
      <div className="h-[calc(100vh-73px)] p-6">
        <div className="max-w-5xl mx-auto">
          <PageHeader className="mb-4">
            <PageHeaderHeading>
              <PageHeaderTitle>练习与评测</PageHeaderTitle>
              <PageHeaderDescription>根据薄弱点与学习进度推荐练习任务</PageHeaderDescription>
            </PageHeaderHeading>
          </PageHeader>

          <PageHeaderFilters className="mb-6">
            <Select value={filterTopic} onValueChange={setFilterTopic}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="选择主题" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部主题</SelectItem>
                <SelectItem value="数组">数组</SelectItem>
                <SelectItem value="指针">指针</SelectItem>
                <SelectItem value="递归">递归</SelectItem>
                <SelectItem value="链表">链表</SelectItem>
                <SelectItem value="排序">排序</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="选择难度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部难度</SelectItem>
                <SelectItem value="入门">入门</SelectItem>
                <SelectItem value="基础">基础</SelectItem>
                <SelectItem value="提高">提高</SelectItem>
              </SelectContent>
            </Select>
          </PageHeaderFilters>

          {isLoading && practiceList.length === 0 && (
            <PageState
              variant="loading"
              size="sm"
              className="border-0 bg-transparent"
              description="正在加载练习列表..."
            />
          )}

          {!isLoading && listError && (
            <PageState
              variant="error"
              size="sm"
              className="border-0 bg-transparent"
              title="练习列表加载失败"
              description={listError}
              action={(
                <Button variant="outline" onClick={loadPracticeList}>
                  重试
                </Button>
              )}
            />
          )}

          {!isLoading && !listError && practiceList.length === 0 && (
            <PageState
              variant="empty"
              size="sm"
              className="border-0 bg-transparent"
              title="暂无练习"
              description="可先去问答页提问或选择主题生成练习"
              icon={BookOpen}
            />
          )}

          <div className="grid gap-4">
            {practiceList.map((item) => (
              <Card 
                key={item.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handlePracticeSelect(item)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{item.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{item.topic}</Badge>
                        <Badge className={getLevelColor(item.level)}>{item.level}</Badge>
                        <div className="flex items-center text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          预计 15-30 分钟
                        </div>
                      </CardDescription>
                      {(item.source || item.adaptiveLevel || item.sourceNote || item.adaptiveNote) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {renderSourceBadge(item.source)}
                          {renderAdaptiveBadge(item.adaptiveLevel)}
                          {item.sourceNote && <span>{item.sourceNote}</span>}
                          {item.adaptiveNote && <span>{item.adaptiveNote}</span>}
                        </div>
                      )}
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Detail View
  return (
    <div className="h-[calc(100vh-73px)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回列表
        </Button>
        <PageHeader className="mt-4">
          <PageHeaderHeading>
            <PageHeaderTitle>{practiceDetail.title}</PageHeaderTitle>
            {(selectedPractice.sourceNote || selectedPractice.adaptiveNote) && (
              <PageHeaderDescription>
                {[selectedPractice.sourceNote, selectedPractice.adaptiveNote].filter(Boolean).join(' · ')}
              </PageHeaderDescription>
            )}
          </PageHeaderHeading>
          <PageHeaderActions>
            <Badge variant="outline">{selectedPractice.topic}</Badge>
            <Badge className={getLevelColor(selectedPractice.level)}>{selectedPractice.level}</Badge>
            {renderSourceBadge(selectedPractice.source)}
            {renderAdaptiveBadge(selectedPractice.adaptiveLevel)}
          </PageHeaderActions>
        </PageHeader>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Problem Description */}
        <div className="w-[45%] overflow-y-auto p-6 border-r">
          <ScrollArea className="h-full">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">题目描述</h3>
                <div className="prose prose-sm max-w-none">
                  {practiceDetail.promptMarkdown.split('\n').map((line, i) => {
                    if (line.startsWith('#')) {
                      const level = line.match(/^#+/)?.[0].length || 1;
                      const text = line.replace(/^#+\s*/, '');
                      return <h4 key={i} className={`font-semibold mt-4 ${level === 1 ? 'text-base' : 'text-sm'}`}>{text}</h4>;
                    }
                    if (line.startsWith('```')) {
                      return <pre key={i} className="bg-muted p-3 rounded text-sm font-mono mt-2">{line.replace(/```/g, '')}</pre>;
                    }
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={i} className="font-medium mt-2">{line.replace(/\*\*/g, '')}</p>;
                    }
                    if (line.startsWith('- ')) {
                      return <li key={i} className="text-sm ml-4">{line.replace('- ', '')}</li>;
                    }
                    return <p key={i} className="text-sm text-muted-foreground">{line}</p>;
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">输入输出说明</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {practiceDetail.ioDesc}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">示例</h3>
                <div className="space-y-3">
                  {practiceDetail.samples.map((sample, i) => (
                    <Card key={i}>
                      <CardHeader className="pb-3">
                        <CardDescription>示例 {i + 1}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <span className="text-xs font-medium">输入：</span>
                          <pre className="bg-muted p-2 rounded text-xs font-mono mt-1">{sample.input}</pre>
                        </div>
                        <div>
                          <span className="text-xs font-medium">输出：</span>
                          <pre className="bg-muted p-2 rounded text-xs font-mono mt-1">{sample.output}</pre>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right: Code Editor & Result */}
        <div className="flex-1 flex flex-col">
          {/* Editor */}
          <div className="flex-1 flex flex-col p-4">
            <div className="flex-1 relative bg-muted rounded-lg overflow-hidden">
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 min-h-[300px] font-mono text-sm resize-none border-0 focus-visible:ring-0"
                placeholder="// 在此编写你的代码..."
                spellCheck={false}
              />
            </div>

            <div className="flex gap-2 mt-4">
              <Button 
                variant="outline"
                className="flex-1"
                disabled={!code.trim()}
              >
                <Play className="w-4 h-4 mr-2" />
                运行测试
              </Button>
              <Button 
                className="flex-1"
                onClick={handleSubmit}
                disabled={isSubmitting || !code.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    提交评测
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Result */}
          <div className="flex-1 overflow-y-auto p-4 border-t bg-muted/20">
            {!submitResult ? (
              <PageState
                variant="empty"
                size="sm"
                className="border-0 bg-transparent"
                title="尚无评测结果"
                description="点击“提交评测”查看结果"
              />
            ) : submitResult.status === 'pass' ? (
              <Card className="border-green-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    测试通过
                  </CardTitle>
                  <CardDescription>得分: {submitResult.score}分</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{submitResult.feedback}</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <XCircle className="w-5 h-5" />
                    测试未通过
                  </CardTitle>
                  <CardDescription>得分: {submitResult.score}分</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{submitResult.feedback}</p>
                  {submitResult.hints.length > 0 && (
                    <Alert>
                      <AlertDescription>
                        <div className="font-medium mb-2">提示：</div>
                        <ul className="space-y-1">
                          {submitResult.hints.map((hint, i) => (
                            <li key={i} className="text-sm">• {hint}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
