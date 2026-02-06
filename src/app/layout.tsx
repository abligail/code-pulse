import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { AppLayout } from '@/components/app-layout';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'CodePulse',
    template: '%s | CodePulse',
  },
  description: '面向程序设计课程（C语言）的智能学习平台',
  keywords: [
    'C语言',
    '智能学习',
    '编程教学',
    '代码评审',
    '在线练习',
  ],
  authors: [{ name: 'CodePulse' }],
  generator: 'Coze Code',
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        <AppLayout>
          {children}
        </AppLayout>
      </body>
    </html>
  );
}
