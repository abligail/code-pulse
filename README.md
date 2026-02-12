# CodePulse（C语言智能学习平台）

面向程序设计课程（C语言）的智能学习平台 Demo：学生端支持知识问答、练习评测、代码运行与评审、学习报告；教师端支持班级看板与教学要求展示。

## 功能概览

- 学生端：知识问答（生成思考题 + 知识卡）、代码评审（语法/风格/逻辑）、练习评测（单题：补弱优先/间隔重复）、考试（套题）、学习报告（薄弱点/复习计划/学习足迹）
- 教师端：班级看板（趋势/词云/学生列表导出）、教学要求面板（按优先级/截止时间展示要求）
- 登录：展示版本地登录（`localStorage`），不接入真实鉴权

## 技术栈

- Next.js App Router + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui（Radix UI）

## 快速开始

环境要求：
- Node.js 20+（Coze 环境为 Node.js 24，见 `.coze`）
- pnpm 9+

安装依赖：
```bash
pnpm install
```

本地开发（跨平台推荐）：
```bash
pnpm exec next dev -p 5002
```
浏览器访问 `http://localhost:5002`。

构建与生产预览（跨平台推荐）：
```bash
pnpm exec next build
pnpm exec next start -p 5002
```

联调（练习/考试/画像服务）：
```bash
cd graph-rag-prog-mind-finish/app
python app.py
```
可通过 `.env.local` 配置后端地址：
```bash
DKT_API_BASE=http://localhost:8000
MONGODB_PROFILE_API_BASE=http://localhost:8000
```

使用脚本（可选）：
- `pnpm run dev/build/start` 会调用 `scripts/*.sh`，需要 Bash 环境（macOS/Linux/WSL/Git Bash）。

## Demo 数据说明（重要）

- 大部分 `/api/*` 接口仍为 mock（`src/app/api/*` + `src/lib/mock-data.ts`），用于演示完整流程。
- 练习评测与考试页已接入真实后端接口（`/questions/single/*`、`/questions/answer`、`/questions/set`、`/questions/set/answer`）。
- 代码评审页相关接口 `/api/run-c` 与 `/api/review` 已接入真实服务逻辑（`src/server/review/*`）。
- 学习足迹 `/api/profile/events` 使用内存数组临时存储（重启服务会清空）。
- 账号信息保存在浏览器本地；清除缓存会导致账号与历史数据丢失。

## 目录结构

```
src/
├── app/                # Next.js App Router（页面 + API 路由）
│   ├── student/        # 学生端：问答/评审/练习/考试/报告
│   ├── teacher/        # 教师端：看板/教学要求
│   └── api/            # API 路由（多数 mock；practice/review/run-c 部分真实化）
├── components/         # 业务组件
│   └── ui/             # shadcn/ui 基础组件
├── lib/
│   ├── api/            # 前端 API client 与类型
│   ├── auth/           # 本地会话（localStorage）
│   └── mock-data.ts    # Mock 数据与逻辑
└── hooks/              # 自定义 Hooks
```
