'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader, PageHeaderDescription, PageHeaderHeading, PageHeaderTitle } from '@/components/ui/page-header';
import { PageState } from '@/components/ui/page-state';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { logUserEvent } from '@/lib/api/events';
import {
  fetchPracticeQuestionSet,
  submitPracticeSetAnswers,
  type ChoiceOption,
  type PracticeQuestion,
  type SetAnswerResponse,
} from '@/lib/api/practice';

const OPTION_ORDER: ChoiceOption[] = ['A', 'B', 'C', 'D'];

export default function ExamPage() {
  const [countInput, setCountInput] = useState('10');
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [zpdApplied, setZpdApplied] = useState(false);
  const [answers, setAnswers] = useState<Record<string, ChoiceOption>>({});
  const [result, setResult] = useState<SetAnswerResponse | null>(null);
  const [isLoadingSet, setIsLoadingSet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resultByQuestion = useMemo(() => {
    const map = new Map<string, SetAnswerResponse['results'][number]>();
    result?.results.forEach((item) => map.set(item.questionId, item));
    return map;
  }, [result]);

  const answeredCount = Object.keys(answers).length;

  const loadSet = async () => {
    setIsLoadingSet(true);
    setError(null);
    setResult(null);
    setAnswers({});
    try {
      const count = Number.parseInt(countInput, 10);
      const normalizedCount = Number.isFinite(count) ? Math.min(Math.max(count, 1), 30) : 10;
      const data = await fetchPracticeQuestionSet({ count: normalizedCount });
      setQuestions(data.questions);
      setZpdApplied(data.zpdApplied);
      if (data.questions.length === 0) {
        setError('后端未返回题目，请调整参数后重试。');
      }
    } catch (loadError) {
      console.error('Failed to load exam set', loadError);
      setQuestions([]);
      setError('生成试卷失败，请确认后端接口已启动。');
    } finally {
      setIsLoadingSet(false);
    }
  };

  const submitSet = async () => {
    if (questions.length === 0 || result) return;
    const payloadAnswers = questions
      .map((question) => {
        const selected = answers[question.id];
        if (!selected) return null;
        return { question_id: question.id, selected_option: selected };
      })
      .filter((item): item is { question_id: string; selected_option: ChoiceOption } => Boolean(item));

    if (payloadAnswers.length !== questions.length) {
      setError('请先完成所有题目再提交。');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const data = await submitPracticeSetAnswers({ answers: payloadAnswers });
      setResult(data);
      const correctCount = data.results.filter((item) => item.isCorrect).length;
      void logUserEvent({
        eventType: 'practice_submit',
        source: 'student/exam',
        metrics: {
          total: data.results.length,
          correct: correctCount,
          accuracy: data.results.length > 0 ? correctCount / data.results.length : 0,
        },
      });
    } catch (submitError) {
      console.error('Failed to submit exam set', submitError);
      setError('提交试卷失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-73px)] overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <PageHeader>
          <PageHeaderHeading>
            <PageHeaderTitle>考试</PageHeaderTitle>
            <PageHeaderDescription>使用“出一套题”接口进行整卷作答与统一评测</PageHeaderDescription>
          </PageHeaderHeading>
        </PageHeader>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">试卷生成</CardTitle>
            <CardDescription>默认生成 10 题，可按需调整数量</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Input
              type="number"
              min={1}
              max={30}
              value={countInput}
              onChange={(event) => setCountInput(event.target.value)}
              className="w-32"
            />
            <Button onClick={loadSet} disabled={isLoadingSet || isSubmitting}>
              {isLoadingSet ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                '生成试卷'
              )}
            </Button>
            {questions.length > 0 && (
              <>
                <Badge variant="secondary">题量：{questions.length}</Badge>
                <Badge variant="outline">{zpdApplied ? '已应用ZPD筛选' : '未应用ZPD筛选'}</Badge>
                <Badge variant="outline">已作答：{answeredCount}/{questions.length}</Badge>
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

        {questions.length === 0 && !isLoadingSet && !error && (
          <PageState
            variant="empty"
            size="sm"
            className="border-0 bg-transparent"
            title="暂无试卷"
            description="点击“生成试卷”从后端获取一套选择题"
          />
        )}

        {questions.map((question, index) => {
          const checked = resultByQuestion.get(question.id);
          const questionOptions = OPTION_ORDER.filter((key) => Boolean(question.options[key]));
          return (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className="text-base">第 {index + 1} 题</CardTitle>
                <CardDescription className="space-y-2">
                  <span className="block text-sm text-foreground">{question.stem}</span>
                  <span className="flex flex-wrap gap-2">
                    <Badge variant="outline">题目ID: {question.id}</Badge>
                    {question.knowledgePoints.map((point) => (
                      <Badge key={`${question.id}-${point}`} variant="secondary">{point}</Badge>
                    ))}
                    {checked && (
                      <Badge variant={checked.isCorrect ? 'secondary' : 'destructive'}>
                        {checked.isCorrect ? '正确' : '错误'}，答案 {checked.correctOption}
                      </Badge>
                    )}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={answers[question.id] ?? ''}
                  onValueChange={(value) =>
                    setAnswers((prev) => ({ ...prev, [question.id]: value as ChoiceOption }))
                  }
                  disabled={Boolean(result)}
                >
                  {questionOptions.map((option) => {
                    const chosen = answers[question.id] === option;
                    const isCorrect = checked?.correctOption === option;
                    const wrongChoice = Boolean(result) && chosen && !isCorrect;
                    const className = isCorrect
                      ? 'border-emerald-500 bg-emerald-50'
                      : wrongChoice
                        ? 'border-red-500 bg-red-50'
                        : 'border-border';

                    return (
                      <label
                        key={`${question.id}-${option}`}
                        htmlFor={`${question.id}-${option}`}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${className}`}
                      >
                        <RadioGroupItem id={`${question.id}-${option}`} value={option} />
                        <div>
                          <span className="mr-2 font-medium">{option}</span>
                          <span className="text-muted-foreground">{question.options[option]}</span>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </CardContent>
            </Card>
          );
        })}

        {questions.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={submitSet} disabled={isSubmitting || isLoadingSet || Boolean(result)}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                '提交试卷'
              )}
            </Button>
            <Button variant="outline" onClick={loadSet} disabled={isLoadingSet || isSubmitting}>
              重新生成
            </Button>
          </div>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {result.results.filter((item) => item.isCorrect).length === result.results.length ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-amber-600" />
                )}
                已完成判题
              </CardTitle>
              <CardDescription>
                正确 {result.results.filter((item) => item.isCorrect).length} / {result.results.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">画像掌握度更新</p>
              {Object.keys(result.updatedKcMastery).length === 0 ? (
                <p className="text-sm text-muted-foreground">后端未返回知识点掌握度明细。</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(result.updatedKcMastery).map(([name, score]) => (
                    <div key={name} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="ml-2 text-muted-foreground">{Number(score).toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.profileUpdateTime && (
                <p className="text-xs text-muted-foreground">更新时间：{result.profileUpdateTime}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

