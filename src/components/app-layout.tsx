'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Code,
  LogOut,
  Menu,
  MessageSquare,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ClientIcon } from '@/components/client-icon';
import { clearActiveUser, getActiveUser, type LocalUser } from '@/lib/auth/session';

const studentNav = [
  { href: '/student/chat', label: '知识问答', icon: MessageSquare },
  { href: '/student/review', label: '代码评审', icon: Code },
  { href: '/student/practice', label: '练习评测', icon: BookOpen },
  { href: '/student/report', label: '学习报告', icon: BarChart3 },
];

const teacherNav = [
  { href: '/teacher/dashboard', label: '班级看板', icon: Users },
  { href: '/teacher/requirements', label: '教学要求面板', icon: ClipboardList },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<LocalUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const isAuthPage = pathname.startsWith('/auth');

  const getPageTitle = () => {
    const allItems = [...studentNav, ...teacherNav];
    for (const item of allItems) {
      if (pathname === item.href || pathname.startsWith(item.href)) {
        return item.label;
      }
    }
    return '首页';
  };

  const navItems = useMemo(() => {
    const items = [
      {
        category: '学生端',
        items: studentNav,
      },
    ];
    if (currentUser?.role === 'teacher') {
      items.push({
        category: '教师端',
        items: teacherNav,
      });
    }
    return items;
  }, [currentUser?.role]);

  useEffect(() => {
    const user = getActiveUser();
    setCurrentUser(user);
    setAuthReady(true);

    if (!user && !isAuthPage) {
      router.replace('/auth/login');
      return;
    }

    if (user && isAuthPage) {
      router.replace(user.role === 'teacher' ? '/teacher/dashboard' : '/student/chat');
      return;
    }

    if (user && pathname.startsWith('/teacher') && user.role !== 'teacher') {
      router.replace('/student/chat');
    }
  }, [isAuthPage, pathname, router]);

  const handleLogout = () => {
    clearActiveUser();
    setCurrentUser(null);
    router.replace('/auth/login');
  };

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="surface-panel px-6 py-5 text-sm text-muted-foreground">
          正在加载会话...
        </div>
      </div>
    );
  }

  if (isAuthPage) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_8%,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(14,116,144,0.2),transparent_30%)]" />
        <div className="relative min-h-screen">{children}</div>
      </div>
    );
  }

  const renderNavGroups = (mobile = false) => (
    <nav className={`flex-1 space-y-6 overflow-y-auto ${mobile ? 'px-4 py-5' : 'px-5 py-6'}`}>
      {navItems.map((category) => (
        <div key={category.category}>
          <h3 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
            {category.category}
          </h3>
          <div className="space-y-1.5">
            {category.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-[0_14px_24px_-18px_rgba(2,6,23,0.95)]'
                      : 'text-slate-100/90 hover:bg-white/12 hover:text-white'
                  }`}
                >
                  <span
                    className={`flex size-7 items-center justify-center rounded-lg ${
                      isActive ? 'bg-slate-900/10 text-slate-900' : 'bg-white/10 text-slate-200 group-hover:bg-white/16'
                    }`}
                  >
                    <ClientIcon icon={Icon} className="size-4" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="relative flex h-svh overflow-hidden">
      <aside className="relative hidden w-72 shrink-0 border-r border-white/10 bg-[linear-gradient(180deg,#0f1f3b_0%,#142a4d_45%,#0d1f3b_100%)] text-slate-100 lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/14 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
            CodePulse
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">C语言智能学习平台</h1>
          <p className="mt-1 text-xs text-slate-300/80">Practice · Review · Report</p>
        </div>

        {renderNavGroups()}

        <div className="border-t border-white/10 p-4">
          <div className="rounded-2xl border border-white/14 bg-white/10 p-3 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Avatar className="size-9 border border-white/20">
                <div className="flex size-full items-center justify-center bg-white/18 text-sm font-semibold text-white">
                  {currentUser?.role === 'teacher' ? '师' : '学'}
                </div>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{currentUser?.name || '访客'}</p>
                <p className="truncate text-[11px] text-slate-300/90">{currentUser?.className || '未绑定班级'}</p>
                <p className="truncate text-[10px] text-slate-400">ID: {currentUser?.userId || '-'}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={handleLogout}>
              <ClientIcon icon={LogOut} className="mr-2 size-4" />
              退出登录
            </Button>
          </div>
        </div>
      </aside>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed left-4 top-4 z-50 border-white/50 bg-white/75 shadow-md backdrop-blur md:left-5 lg:hidden"
          >
            <ClientIcon icon={Menu} className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 border-r border-white/10 bg-[linear-gradient(180deg,#0f1f3b_0%,#142a4d_45%,#0d1f3b_100%)] p-0 text-slate-100"
        >
          <div className="border-b border-white/10 px-5 py-5">
          <div className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/14 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
            CodePulse
          </div>
            <h1 className="mt-3 text-lg font-semibold text-white">C语言智能学习平台</h1>
          </div>
          {renderNavGroups(true)}
        </SheetContent>
      </Sheet>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-10 flex items-center justify-between gap-4 border-b border-border/65 bg-background/80 px-4 py-3 backdrop-blur-md lg:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">{getPageTitle()}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {currentUser?.role === 'teacher' ? '教师端' : '学生端'} · {currentUser?.className || '未绑定班级'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              ID {currentUser?.userId || '-'}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              退出
            </Button>
            <Avatar className="size-9 border border-white/80 shadow-[0_12px_18px_-16px_rgba(15,23,42,0.9)]">
              <div className="flex size-full items-center justify-center bg-primary/15 font-semibold text-primary">
                {currentUser?.role === 'teacher' ? '师' : '学'}
              </div>
            </Avatar>
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
