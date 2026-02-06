'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveUser } from '@/lib/auth/session';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getActiveUser();
    if (!user) {
      router.replace('/auth/login');
      return;
    }

    router.replace(user.role === 'teacher' ? '/teacher/dashboard' : '/student/chat');
  }, [router]);

  return null;
}
