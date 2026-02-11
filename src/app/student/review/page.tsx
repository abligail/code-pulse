'use client';

import { useRef, useState } from 'react';
import { Play, Trash2, Save, Loader2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, PageHeaderDescription, PageHeaderHeading, PageHeaderTitle } from '@/components/ui/page-header';
import { PageState } from '@/components/ui/page-state';
import {
  requestReview,
  runCode,
  type ReviewBranchResponse,
  type ReviewMode,
  type ReviewResult,
  type RunResult,
} from '@/lib/api/review';
import { logUserEvent } from '@/lib/api/events';

const exampleCode = `#include <stdio.h>
#include <stdlib.h>

int main() {
    int arr[5] = {1, 2, 3, 4, 5};
    int *p = arr;
    
    // Print array elements
    for(int i = 0; i < 5; i++) {
        printf("%d ", *(p + i));
    }
    printf("\\n");
    
    return 0;
}`;

const createRoundId = () => {
  const timePart = Date.now().toString(36);
  const randPart = Math.random().toString(36).slice(2, 8);
  return `rr_${timePart}_${randPart}`;
};

const REVIEW_MODES: ReviewMode[] = ['syntax', 'style', 'logic'];

const EMPTY_REVIEW_LOADING: Record<ReviewMode, boolean> = {
  syntax: false,
  style: false,
  logic: false,
};

export default function ReviewPage() {
  const [code, setCode] = useState(exampleCode);
  const [input, setInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [reviews, setReviews] = useState<Partial<Record<ReviewMode, ReviewResult>>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isReviewing, setIsReviewing] = useState<Record<ReviewMode, boolean>>(EMPTY_REVIEW_LOADING);
  const activeRoundRef = useRef<string | null>(null);

  const trackRunEvent = (roundId: string, data: RunResult, hasInput: boolean) => {
    void logUserEvent({
      eventType: 'review_run',
      source: 'student/review',
      roundId,
      metrics: {
        success: data.success,
        errorType: data.errorType ?? null,
        exitCode: data.exitCode ?? data.data?.exitCode ?? null,
        compileTime: data.data?.compileTime ?? null,
        runTime: data.data?.runTime ?? null,
        totalTime: data.data?.totalTime ?? null,
        hasInput,
      },
    });
  };

  const trackReviewEvent = (roundId: string, payload: ReviewBranchResponse, runData: RunResult) => {
    void logUserEvent({
      eventType: 'review_run',
      source: 'student/review',
      roundId,
      metrics: {
        success: runData.success,
        errorType: runData.errorType ?? null,
        mode: payload.metrics.mode,
        issueCount: payload.metrics.issueCount,
        highestSeverity: payload.metrics.highestSeverity,
        weakCandidateCount: payload.metrics.weakCandidateCount,
        syncAdded: payload.metrics.syncAdded,
        syncUpdated: payload.metrics.syncUpdated,
        syncSkipped: payload.metrics.syncSkipped,
        syncErrors: payload.metrics.syncErrors,
      },
    });
  };

  const handleRunCode = async () => {
    const roundId = createRoundId();
    const codeSnapshot = code;
    const inputSnapshot = input || undefined;
    activeRoundRef.current = roundId;
    setIsRunning(true);
    setRunResult(null);
    setReviews({});
    setIsReviewing({ ...EMPTY_REVIEW_LOADING });

    try {
      const data = await runCode({ code: codeSnapshot, input: inputSnapshot });
      if (activeRoundRef.current !== roundId) return;
      setRunResult(data);
      trackRunEvent(roundId, data, Boolean(inputSnapshot));

      // Trigger all review branches even when run fails.
      triggerReviews({ runData: data, roundId, codeSnapshot });
    } catch (error) {
      console.error('Failed to run code:', error);
      if (activeRoundRef.current !== roundId) return;
      const fallbackRunResult: RunResult = {
        success: false,
        errorType: '网络错误',
        errorSummary: '无法连接到代码运行服务',
        error: '请检查网络连接后重试',
      };
      setRunResult(fallbackRunResult);
      trackRunEvent(roundId, fallbackRunResult, Boolean(inputSnapshot));
      triggerReviews({ runData: fallbackRunResult, roundId, codeSnapshot });
    } finally {
      if (activeRoundRef.current === roundId) {
        setIsRunning(false);
      }
    }
  };

  const triggerReviews = ({
    runData,
    roundId,
    codeSnapshot,
  }: {
    runData: RunResult;
    roundId: string;
    codeSnapshot: string;
  }) => {
    REVIEW_MODES.forEach((mode) => {
      if (activeRoundRef.current !== roundId) return;
      setIsReviewing((prev) => ({ ...prev, [mode]: true }));
      requestReview({
        code: codeSnapshot,
        mode,
        runResult: runData,
        roundId,
      })
        .then((data) => {
          if (activeRoundRef.current !== roundId) return;
          setReviews((prev) => ({ ...prev, [mode]: data.review }));
          trackReviewEvent(roundId, data, runData);
        })
        .catch((error) => {
          console.error(`Failed to review ${mode}:`, error);
          if (activeRoundRef.current !== roundId) return;
          setReviews((prev) => ({
            ...prev,
            [mode]: {
              status: 'error',
              summary: '该分支暂不可用',
              details: [],
              suggestions: [],
              questions: [],
            },
          }));
          void logUserEvent({
            eventType: 'review_run',
            source: 'student/review',
            roundId,
            metrics: {
              success: runData.success,
              errorType: runData.errorType ?? null,
              mode,
              issueCount: 0,
              highestSeverity: 0,
              weakCandidateCount: 0,
              syncAdded: 0,
              syncUpdated: 0,
              syncSkipped: 0,
              syncErrors: 1,
              reviewError: error instanceof Error ? error.message : String(error),
            },
          });
        })
        .finally(() => {
          if (activeRoundRef.current !== roundId) return;
          setIsReviewing((prev) => ({ ...prev, [mode]: false }));
        });
    });
  };

  const clearCode = () => {
    activeRoundRef.current = null;
    setIsRunning(false);
    setIsReviewing({ ...EMPTY_REVIEW_LOADING });
    setCode('');
    setRunResult(null);
    setReviews({});
  };

  const insertExample = () => {
    setCode(exampleCode);
  };

  return (
    <div className="relative flex h-[calc(100vh-73px)] flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_88%_10%,rgba(14,116,144,0.12),transparent_32%)]" />

      <div className="relative border-b border-border/65 bg-card/72 px-6 py-4 backdrop-blur-sm">
        <PageHeader>
          <PageHeaderHeading>
            <PageHeaderTitle>代码评审</PageHeaderTitle>
            <PageHeaderDescription>运行代码并获得语法、风格与逻辑建议</PageHeaderDescription>
          </PageHeaderHeading>
        </PageHeader>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-border/65 bg-background/40 xl:border-b-0 xl:border-r">
          <div className="border-b border-border/60 p-4 lg:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">代码编辑器</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={insertExample}>
                  插入示例代码
                </Button>
                <Button variant="outline" size="sm" onClick={clearCode}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  清空
                </Button>
                <Button variant="outline" size="sm">
                  <Save className="mr-2 h-4 w-4" />
                  保存草稿
                </Button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-muted/34">
              <div className="absolute bottom-0 left-0 top-0 w-12 select-none border-r border-border/60 bg-muted/60 pr-2 pt-4 text-right font-mono text-xs text-muted-foreground">
                {code.split('\n').map((_, i) => (
                  <div key={i} className="leading-6">
                    {i + 1}
                  </div>
                ))}
              </div>

              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="min-h-[320px] flex-1 resize-none border-0 bg-transparent pl-14 font-mono text-sm focus-visible:ring-0"
                placeholder="// 在此输入你的C语言代码..."
                spellCheck={false}
              />
            </div>

            <Collapsible open={showInput} onOpenChange={setShowInput} className="mt-4">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  {showInput ? '收起输入区' : '展开输入区 (stdin)'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="输入测试数据..."
                  rows={3}
                />
              </CollapsibleContent>
            </Collapsible>

            <Button onClick={handleRunCode} disabled={isRunning || !code.trim()} className="mt-4 w-full" size="lg">
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  运行中...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  运行代码
                </>
              )}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-4 lg:p-5">
            <h3 className="mb-4 font-semibold">运行结果</h3>

            {isRunning && (
              <PageState
                variant="loading"
                size="sm"
                className="border-0 bg-transparent"
                description="正在运行代码..."
              />
            )}

            {!isRunning && !runResult && (
              <PageState
                variant="empty"
                size="sm"
                className="border-0 bg-transparent"
                title="尚无运行结果"
                description="点击上方“运行代码”查看结果"
              />
            )}

            {runResult && runResult.success && runResult.data && (
              <Card className="surface-panel-strong border-emerald-200/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                    运行成功
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <CardDescription className="mb-1">输出:</CardDescription>
                    <pre className="overflow-x-auto rounded-xl border border-border/70 bg-muted/45 p-3 font-mono text-sm">
                      {runResult.data.output || '(无输出)'}
                    </pre>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <div>编译时间: {runResult.data.compileTime}</div>
                    <div>运行时间: {runResult.data.runTime}</div>
                    <div>总时间: {runResult.data.totalTime}</div>
                    <div>退出码: {runResult.data.exitCode}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {runResult && !runResult.success && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    {runResult.errorType || '运行失败'}
                  </CardTitle>
                  <CardDescription>{runResult.errorSummary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {runResult.errorLinesSummary && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        错误行: {runResult.errorLines?.join(', ')} - {runResult.errorLinesSummary}
                      </AlertDescription>
                    </Alert>
                  )}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs">
                        查看完整错误信息
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <pre className="overflow-x-auto rounded-xl border border-border/70 bg-muted/45 p-3 font-mono text-sm">
                        {runResult.error}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="h-[42vh] overflow-y-auto border-t border-border/65 bg-background/56 xl:h-auto xl:w-[420px] xl:border-l xl:border-t-0">
          <div className="p-4">
            <h3 className="mb-4 font-semibold">代码评审</h3>

            <Tabs defaultValue="syntax" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="syntax">语法</TabsTrigger>
                <TabsTrigger value="style">风格</TabsTrigger>
                <TabsTrigger value="logic">逻辑</TabsTrigger>
              </TabsList>

              {REVIEW_MODES.map((mode) => (
                <TabsContent key={mode} value={mode}>
                  <ReviewContent
                    review={reviews[mode]}
                    isLoading={isReviewing[mode]}
                    mode={mode}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewContent({ review, isLoading, mode }: { review?: ReviewResult; isLoading: boolean; mode: 'syntax' | 'style' | 'logic' }) {
  const modeNames = {
    syntax: '语法评审',
    style: '风格评审',
    logic: '逻辑评审'
  };

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!review) {
    return (
      <PageState
        variant="empty"
        size="sm"
        className="border-0 bg-transparent"
        title="尚无评审结果"
        description="运行代码后自动生成评审"
      />
    );
  }

  if (review.status === 'timeout' || review.status === 'error') {
    return (
      <PageState
        variant="error"
        size="sm"
        className="border-0 bg-transparent"
        title="评审服务不可用"
        description={review.summary}
      />
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{modeNames[mode]}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{review.summary}</p>
        </CardContent>
      </Card>

      {review.details.length > 0 && (
        <Card>
          <CardHeader>
            <CardDescription>要点</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {review.details.map((detail, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary">•</span>
                  <span className="leading-relaxed">{detail}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {review.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardDescription>改进建议</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {review.suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary">+</span>
                  <span className="leading-relaxed">{suggestion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {review.questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardDescription>引导问题</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {review.questions.map((question, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary">?</span>
                  <span className="leading-relaxed">{question}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 text-center text-xs text-muted-foreground">
        提示：评审仅提供思路和提示，不直接给出完整代码
      </div>
    </div>
  );
}
