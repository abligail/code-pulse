'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClientIcon } from '@/components/client-icon';
import { PageHeader, PageHeaderDescription, PageHeaderHeading, PageHeaderTitle } from '@/components/ui/page-header';
import { generateUserId, setActiveUser, type UserRole } from '@/lib/auth/session';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [className, setClassName] = useState('');
  const [userId] = useState(() => generateUserId());
  const [error, setError] = useState('');

  const roleTips = useMemo(
    () =>
      role === 'teacher'
        ? '教师账号将解锁班级看板与教学要求面板。'
        : '学生账号将获得知识问答、练习评测与学习报告功能。',
    [role]
  );

  const handleRegister = () => {
    setError('');
    if (!name.trim()) {
      setError('请输入姓名');
      return;
    }

    const user = {
      userId,
      name: name.trim(),
      role,
      className: className.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setActiveUser(user);
    router.replace(role === 'teacher' ? '/teacher/dashboard' : '/student/chat');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_86%_14%,rgba(14,116,144,0.2),transparent_30%)]" />
      <div className="relative w-full max-w-3xl">
        <Card className="surface-panel border-0 bg-card/82 py-5">
          <CardHeader>
            <PageHeader>
              <PageHeaderHeading className="space-y-3">
                <Badge variant="secondary" className="w-fit">展示版 · 账号注册</Badge>
                <PageHeaderTitle className="text-3xl text-gradient-brand">创建你的学习身份</PageHeaderTitle>
                <PageHeaderDescription className="text-base">
                  完成注册后会生成专属 userId，请妥善保存。
                </PageHeaderDescription>
              </PageHeaderHeading>
            </PageHeader>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>姓名</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：张同学" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>角色</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择角色" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">学生</SelectItem>
                      <SelectItem value="teacher">教师</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>班级/组织</Label>
                  <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="例如：计算机2班" />
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/60 p-4 text-sm text-muted-foreground">
                {roleTips}
              </div>
              {error && <div className="text-sm text-destructive">{error}</div>}
              <Button className="w-full" onClick={handleRegister}>
                <ClientIcon icon={Sparkles} className="w-4 h-4 mr-2" />
                完成注册并进入系统
              </Button>
              <div className="text-sm text-muted-foreground">
                已有账号？<Link href="/auth/login" className="text-primary hover:underline">去登录</Link>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-primary/35 bg-background/88 p-6">
                <div className="text-sm text-muted-foreground">系统生成的 userId</div>
                <div className="mt-3 text-xl font-semibold tracking-wider">{userId}</div>
                <div className="mt-3 text-xs text-muted-foreground">
                  请在演示时保存此 ID，用于后续登录。
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/60 p-4 text-sm text-muted-foreground">
                - 所有数据保存在浏览器本地。
                - 清除缓存会导致账号与历史数据丢失。
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
