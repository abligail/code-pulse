# 前端优化计划（API 未最终确定）
> 更新日期：2026-02-05

## 目标
- 在不依赖最终 API 的前提下，完善学生端与教师端的核心学习闭环与数据可视化体验。
- 通过统一的页面状态、交互和信息结构，为后续 API 对接留出明确的数据契约与组件边界。

## 约束
- API 结构未最终确定，前端以 mock 数据与接口适配层为主。
- 优先优化现有页面与导航结构，不大幅重写框架。
- 教学要求展示页为“展示优先”，数据字段允许与后端最终结构有出入（以视觉呈现为主）。

## 需求结论（已敲定）
- 注册/登录：纯前端本地实现（用于展示），注册时生成 `userId`，登录可复用 `userId`。
- 身份区分：登录时区分学生/教师；教师登录后可见额外的教师看板与“教学要求展示面板”页面。
- 用户画像写入：覆盖全范围；以“每轮对话（round）”为一次写入单位（一次 round 写一次）。
- 动画 Python 代码：暂时废弃，不纳入本期前端范围。
- 代码拆分：页面不直接调用 `fetch()`；统一走 `src/lib/api/*` 适配层，便于后端同学对接真实 API。
- 教学要求展示面板：卡片网格优先（强调美观与可读性）。

## 当前完成情况（基于现有代码）
已完成：
- 登录/注册/角色分流/路由保护（`/auth/*` + `AppLayout`）。
- API 适配层统一并自动透传 `x-user-id`。
- 学生端：知识问答、问题卡翻转、上次问题回顾、知识卡面板、聊天自动滚动。
- 练习评测：题目来源/难度建议展示、列表/详情/提交评测。
- 学习报告：今日复习队列（含逾期/今日/明日）、快速测验、薄弱点/错误统计、复习计划、学习足迹。
- 组件沉淀：`PageHeader` + `PageState`（loading/error/empty），已覆盖学习报告/练习列表/教师端页面。
- 学习报告概念卡抽屉：复用知识卡面板（`KnowledgeCardsPanel`），支持“去看概念卡”联动展示。
- 用户画像事件：前端埋点 + `/api/profile/events` mock，覆盖 chat/practice/review/quiz/knowledge card。
- `PageHeader`/`PageState` 覆盖 chat/review/认证页/练习详情，补齐知识卡与评审空态/错误态。
- 学习足迹展示增强：类型/来源/知识点/得分字段可视化 + 筛选。
- 教师端：班级看板 + 词云/聚类、教学要求展示面板。
- DTO 草案已落盘（`src/lib/api/types.ts`）。

待完善：
- 事件字段标准化与对接说明（`UserEventDTO` metrics 约定）。
- 学习足迹与教师侧聚合页对接（可选）。
- 知识点导入与节点性质对接（真实 DB/映射入口）。

## 讨论点缺口对照（更新）
1. 向共享数据库里写入用户画像：部分补齐（已完成事件写入 + mock API；共享数据库对接待后端）。
2. 每次回复生成一个问题，卡片掩盖后翻动：已补齐。
3. 监控学生提问并生成集中点/词云：已补齐（教师看板）。
4. 用户开始使用先温习上一次的问题：已补齐。
5. 匹配教学要求并动态调整难度：本期不做（展示优先）。
6. 艾宾浩斯曲线复习过滤与复习内容注入：部分补齐（ISO 日期 + 逾期/今日/明日提示；算法仍为 mock）。
7. 生成一个问题进行简单测验：已补齐（学习报告）。
8. 导入数据库定义的知识点：部分补齐（已有知识卡，但无映射入口）。
9. 新写入节点性质与旧分类对接：待补齐。

## 阶段计划（更新）
0. 阶段 0：注册/登录与用户身份（展示用）
- [done] 注册/登录页、生成 `userId`。
- [done] 请求统一携带 `x-user-id`。
- [done] App 级路由保护与教师/学生分流。

1. 阶段 A：体验与结构优化
- [done] loading/error/empty 状态组件化与一致化（已覆盖 chat/review/认证页/练习详情/学习报告/练习列表/教师端）。
- [done] 页面顶部信息结构（标题/提示/操作）统一（已覆盖 chat/review/认证页/练习详情/学习报告/练习列表/教师端）。

2. 阶段 B：学生端学习闭环补齐
- [done] 聊天页“本轮总结问题卡 + 翻转动画”。
- [done] “今日复习”与“快速测验”。
- [done] 练习页补充“难度自适应”提示与题目来源标识。
- [done] 学习报告“去看概念卡”与知识卡面板联动（抽屉复用）。

3. 阶段 C：教师端监控与配置
- [done] 班级看板新增“问题聚类/词云”。
- [done] 教学要求展示面板（卡片网格）。

4. 阶段 D：数据契约与对接准备
- [partial] DTO 草案已定义。
- [done] 用户画像事件写入与可观测（便于后端聚合）。
- [todo] 事件字段标准化与对接说明（可选）。

## 本轮实施计划（2026-02-05）
1. [done] 前端事件埋点 + `/api/profile/events` mock，覆盖 chat/practice/review/quiz/knowledge card。
2. [done] 练习页加入“来源/难度建议”展示（mock + UI）。
3. [done] 复习队列日期改为 ISO，新增“逾期/今日/明日”提示。
4. [done] 修复聊天滚动容器 ref 与自动滚动。
5. [done] 抽出 `KnowledgeCardsPanel`，学习报告概念卡抽屉复用。
6. [done] 新增 `PageHeader`/`PageState` 并覆盖学习报告/练习列表/教师端页面。
7. [done] `PageHeader`/`PageState` 覆盖 chat/review/认证页/练习详情，补齐错误态与空态文案。
8. [done] 学习足迹展示增强（类型/来源/知识点/得分字段可视化，可筛选）。

## 下一轮实施计划（2026-02-05 更新）
1. 事件字段标准化与对接说明（可选，对应 `UserEventDTO`）。
2. 学习足迹与教师侧聚合页对接（可选）。
3. 知识点导入与节点性质对接（真实 DB/映射入口）。

## 视觉优化缺口评估（2026-02-06）
- 页面视觉风格仍偏“默认组件风”：层次和品牌辨识度不足。
- 布局容器、卡片、按钮、导航在阴影/圆角/留白上缺少统一规范。
- 高密度页面（聊天、知识卡、学习报告）信息可读性有提升空间。
- 页面动效偏少，状态切换与关键交互的反馈不够明确。
- 移动端入口可用，但顶部区域和侧栏交互视觉对比度一般。

## 阶段 E：前端美观与交互质感优化（新增）
- [done] 统一视觉设计令牌：主色、强调色、背景层次、圆角与阴影梯度。
- [done] 优化应用框架（侧栏/顶栏/内容区）并建立一致的页面壳层风格。
- [done] 优化高频组件观感：Card/Button/PageHeader/PageState 的视觉一致性。
- [done] 强化高频页面体验：聊天页消息区、知识卡面板、认证页视觉层次。
- [partial] 补充轻量动效（页面进入、悬停反馈、卡片翻转细节）并保持移动端可用。

## 本轮实施计划（2026-02-06）
1. [done] 更新 `globals.css` 主题变量与背景氛围，形成统一视觉基线。
2. [done] 升级 `app-layout.tsx`，重做侧栏与顶栏视觉结构。
3. [done] 统一 `Card/Button/PageHeader` 样式语义，提升页面一致性。
4. [done] 优化 `student/chat` + `KnowledgeCardsPanel` 的信息层级与阅读体验。
5. [blocked] 运行 lint / 类型检查（当前环境缺少 `node`，命令无法执行）。

## 视觉问题复盘（2026-02-06 第二轮）
- 全局风格已统一到“蓝青系”，但页面之间的“层级节奏”仍不稳定：有些区块视觉过平，有些区块信息过密。
- 高密度页面（聊天、代码评审、练习详情）仍存在“主次不够明显”的问题，用户视线需要更强引导。
- 表单控件（输入框/选择器/标签页）观感接近默认样式，与页面壳层的高级感存在落差。
- 状态切换动效有基础，但关键内容（消息卡、评审卡、结果卡）的进入反馈还不够连贯。

## 阶段 F：视觉精修 II（新增）
- [done] 增强全局视觉语义：补齐可复用的 panel/动效/交互样式类（含 reduced-motion 兜底）。
- [done] 精修基础控件观感：`Input`/`Textarea`/`Select`/`Tabs`/`Card`/`Progress`。
- [done] 重构聊天页视觉层次：消息区、输入区、知识卡侧栏、问题翻转卡统一到同一视觉语言。
- [done] 优化代码评审页密度布局：编辑区、运行结果、评审区分层更明确，滚动和阅读路径更清晰。
- [partial] 逐页细化（练习页/学习报告/教师页）仍可继续做卡片信息密度与移动端节奏优化。

## 本轮实施计划（2026-02-06 第二轮）
1. [done] 在 `globals.css` 增加 `surface-panel-strong` / `surface-panel-soft` / `hover-lift` / `motion-fade-up` 等语义类。
2. [done] 调整基础控件阴影、边框、聚焦反馈和激活态，提升细节质感。
3. [done] 改造 `student/chat` 的结构层次与交互反馈（消息、问题卡、输入区、知识卡）。
4. [done] 改造 `student/review` 的编辑区与评审区布局密度。
5. [blocked] 运行 lint / 类型检查（当前环境无 `node`，无法执行）。

## 数据契约草案（前端 DTO）
```ts
export type MasteryLevel = 1 | 2 | 3 | 4 | 5;

export interface UserProfileDTO {
  userId: string;
  mastery: Array<{ nodeId: string; name: string; nodeType: string; level: MasteryLevel; lastSeenAt: string }>;
  reviewQueue: Array<{ nodeId: string; name: string; dueAt: string; reason: 'ebbinghaus' | 'weak' | 'teacher' }>;
  lastQuestion?: { id: string; title: string; askedAt: string };
}

export interface ChatRoundSummaryDTO {
  roundId: string;
  questionCard: { title: string; prompt: string; hints: string[] };
}

export interface QuickQuizDTO {
  quizId: string;
  question: string;
  options?: string[];
  answerType: 'single' | 'text';
}

export interface TeacherRequirementDTO {
  classId: string;
  className?: string;
  updatedAt?: string;
  nodes: Array<{
    nodeId: string;
    nodeName?: string;
    nodeType?: string;
    targetMastery: MasteryLevel;
    minChatRounds?: number;
    minPracticeCount?: number;
    priority?: 1 | 2 | 3 | 4 | 5;
    deadlineAt?: string;
    tags?: string[];
    note?: string;
    groupName?: string;
  }>;
}

export interface QuestionClusterDTO {
  clusterId: string;
  label: string;
  topKeywords: string[];
  count: number;
}

export type UserEventType =
  | 'chat_round'
  | 'practice_submit'
  | 'review_run'
  | 'quiz_submit'
  | 'knowledge_card_open';

export interface UserEventDTO {
  eventId: string;
  userId: string;
  occurredAt: string;
  eventType: UserEventType;
  source: string; // e.g. 'student/chat'
  roundId?: string;
  conversationId?: string;
  knowledgeNodes?: Array<{ nodeId: string; nodeName?: string }>;
  metrics?: Record<string, unknown>;
}
```

## 默认约定（可调整）
- 教学要求展示面板：独立页面；卡片网格优先；缺字段自动隐藏，不阻塞展示。
- 教学要求字段（最小集）：`classId`、`className`、`updatedAt`；节点：`nodeId`、`nodeName`、`nodeType`、`targetMastery`、`minChatRounds`、`minPracticeCount`、`priority`。
- 教学要求字段（可选）：`deadlineAt`、`tags[]`、`note`、`groupName`（章节/周次/模块）。
- 教学要求默认排序：`priority` 降序；`deadlineAt` 升序（有则优先）；`targetMastery` 降序；`nodeType`；`nodeName`。
- 用户画像写入方式：事件日志（append-only）；后端可按事件聚合成画像。
- 用户画像事件类型：`chat_round`、`practice_submit`、`review_run`、`quiz_submit`、`knowledge_card_open`（可选）。
- 用户画像最小 payload：`eventId`、`userId`、`occurredAt`、`eventType`、`source`、`knowledgeNodes[]`、`metrics`（可选）；chat round 额外带 `roundId/conversationId`（可选）。
- `userId` 透传：前端默认使用请求头 `x-user-id`；后端兼容优先级建议 `x-user-id` > `?userId=` > body。
