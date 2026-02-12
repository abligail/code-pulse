'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, PageHeaderDescription, PageHeaderHeading, PageHeaderTitle } from '@/components/ui/page-header';
import { PageState } from '@/components/ui/page-state';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { logUserEvent } from '@/lib/api/events';
import {
  fetchSinglePracticeQuestion,
  submitSinglePracticeAnswer,
  type ChoiceOption,
  type PracticeQuestion,
  type PracticeStrategy,
  type SingleAnswerResponse,
} from '@/lib/api/practice';

const STRATEGY_LABEL: Record<PracticeStrategy, string> = {
  weakest: '补弱优先',
  spaced: '间隔重复',
};

const OPTION_ORDER: ChoiceOption[] = ['A', 'B', 'C', 'D'];

export default function PracticePage() {
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
