'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ClientIcon } from '@/components/client-icon';
import { PageHeader, PageHeaderDescription, PageHeaderHeading, PageHeaderTitle } from '@/components/ui/page-header';
import { PageState } from '@/components/ui/page-state';
import {
  findUserById,
  listUsers,
  setActiveUser,
  type LocalUser,
  type UserRole,
} from '@/lib/auth/session';

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [className, setClassName] = useState('');
  const [error, setError] = useState('');
  const [users, setUsers] = useState<LocalUser[]>([]);

  useEffect(() => {
    setUsers(listUsers());
  }, []);

  const handleQuickLogin = (user: LocalUser) => {
    setActiveUser(user);
    router.replace(user.role === 'teacher' ? '/teacher/dashboard' : '/student/chat');
  };

  const handleLogin = () => {
    setError('');
    const trimmedId = userId.trim();
    if (!trimmedId) {
      setError('请输入 userId');
      return;
    }
    const existing = findUserById(trimmedId);
    const user = existing || {
      userId: trimmedId,
      name: name.trim() || (role === 'teacher' ? '教师' : '学生'),
      role,
      className: className.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    setActiveUser(user);
    router.replace(user.role === 'teacher' ? '/teacher/dashboard' : '/student/chat');
  };

  const recentUsers = useMemo(() => users.slice(0, 6), [users]);

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(14,116,144,0.2),transparent_30%)]" />
      <div className="relative grid w-full max-w-4xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="surface-panel border-0 bg-card/72 py-4">
          <CardHeader>
            <PageHeader>
              <PageHeaderHeading className="space-y-3">
                <Badge variant="secondary" className="w-fit">展示版 · 本地登录</Badge>
                <PageHeaderTitle className="text-3xl text-gradient-brand">欢迎回来</PageHeaderTitle>
                <PageHeaderDescription className="text-base">
                  使用 userId 快速进入系统，或从最近账号中一键登录。
                </PageHeaderDescription>
              </PageHeaderHeading>
            </PageHeader>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="quick">
              <TabsList className="grid w-full grid-cols-2 bg-muted/80">
                <TabsTrigger value="quick">最近账号</TabsTrigger>
                <TabsTrigger value="userId">使用 userId</TabsTrigger>
              </TabsList>
              <TabsContent value="quick" className="mt-4">
                {recentUsers.length === 0 ? (
                  <PageState
                    variant="empty"
                    size="sm"
                    className="bg-transparent"
                    title="暂无最近账号"
                    description="请先注册或使用 userId 登录。"
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recentUsers.map((user) => (
                      <Card key={user.userId} className="cursor-pointer border-border/70 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_28px_-24px_rgba(15,23,42,0.8)]" onClick={() => handleQuickLogin(user)}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <ClientIcon icon={User} className="w-4 h-4" />
                            {user.name}
                          </CardTitle>
                          <CardDescription className="text-xs">ID: {user.userId}</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 text-xs text-muted-foreground">
                          {user.role === 'teacher' ? '教师' : '学生'} · {user.className || '未绑定班级'}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="userId" className="mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>userId</Label>
                    <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="例如：u_k1x8g2_ab12" />
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
                      <Label>姓名</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="可选" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>班级/组织</Label>
                    <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="可选" />
                  </div>
                  {error && <div className="text-sm text-destructive">{error}</div>}
                  <Button className="w-full" onClick={handleLogin}>
                    <ClientIcon icon={KeyRound} className="w-4 h-4 mr-2" />
                    登录
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="surface-panel border-0 bg-card/84 py-4">
          <CardHeader>
            <CardTitle>第一次使用？</CardTitle>
            <CardDescription>
              注册后系统会生成专属 userId，用于后续登录。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-muted/62 p-4 text-sm text-muted-foreground">
              - 本项目为展示版，所有数据保存在浏览器本地。
              - 清除浏览器缓存会导致账号信息丢失。
            </div>
            <Link href="/auth/register">
              <Button className="w-full" variant="outline">去注册</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
