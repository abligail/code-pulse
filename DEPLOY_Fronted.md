# CodePulse Windows 本地部署文档

本文基于当前仓库的 `package.json`、`README.md`、`.env.local`、`api.md`、`src/app/api/*`、`src/server/*` 和页面代码整理，仅面向 Windows 本地部署。

说明：
- 以代码和配置为准，不以 README 的描述优先。
- 本仓库是 `Next.js` 前端项目，但不是“纯静态前端”：部分页面使用 mock 数据，部分页面会代理到外部后端，部分接口会直接连接本地 MongoDB。
- 仓库中的 `scripts/dev.sh`、`scripts/build.sh`、`scripts/start.sh` 依赖 Bash，不适合原生 Windows PowerShell；Windows 环境请直接使用 `pnpm exec next ...`。

## 1. 项目简介

项目名称：`code-pulse`（README 标题为“CodePulse（C语言智能学习平台）”）。

项目用途：
- 面向程序设计课程（C 语言）的教学演示平台。
- 学生端提供知识问答、练习评测、代码运行与评审、考试、学习报告。
- 教师端提供班级看板、教学要求面板。

模块组成：
- 认证模块：`/auth/login`、`/auth/register`
  - 使用 `localStorage` 保存当前登录用户和最近登录用户。
  - 注册时会额外调用 `/api/mongodb/users` 把基础用户信息写入 MongoDB；即使 MongoDB 不可用，前端本地登录仍可继续。
- 学生端：`/student/chat`、`/student/review`、`/student/practice`、`/student/exam`、`/student/report`
  - `chat` 当前是 mock 响应。
  - `review` 会调用本地 `/api/run-c` 和 `/api/review`，其中 `/api/run-c` 需要本机可用的 C 编译器。
  - `practice`、`exam` 会代理到 `DKT_API_BASE` 指向的外部题库/画像后端。
- 教师端：`/teacher/dashboard`、`/teacher/requirements`
  - `dashboard` 自身有 mock 看板数据，但“薄弱画像监控”会额外请求画像服务和本地 MongoDB 用户信息。
  - `requirements` 当前为 mock 数据。
- 本地 API：`src/app/api/*`
  - 一部分是 mock/in-memory 接口，例如 `/api/chat`、`/api/profile/events`、`/api/teacher/dashboard`。
  - 一部分是代理接口，例如 `/api/practice/*`、`/api/user-profile/*`、`/api/mongodb/user_profiles`。
  - 一部分是本地服务逻辑，例如 `/api/run-c`、`/api/review`、`/api/mongodb/users`。

## 2. 环境要求

下表只列当前仓库能从代码中确认的要求；无法从仓库确认的版本，不做臆测。

| 组件 | 是否必须 | 版本要求 / 现状 | 依据 | 说明 |
| --- | --- | --- | --- | --- |
| Windows | 必须 | Windows 10/11 均可 | 用户要求 | 本文命令默认在 PowerShell 中执行。 |
| Git | 建议 | 仓库未声明最低版本 | 当前仓库为 Git 仓库 | 用于克隆代码。 |
| Node.js | 必须 | `20+` | `README.md` | 当前项目使用 `Next.js 16.1.1`、`React 19.2.3`。 |
| pnpm | 必须 | `>= 9.0.0`，并声明 `packageManager: pnpm@9.0.0` | `package.json` | `preinstall` 强制只允许 `pnpm` 安装依赖。 |
| MongoDB | 按功能需要 | 仓库未声明最低版本 | `src/server/mongodb/client.ts`、`api.md` | 本地 `/api/mongodb/users` 默认连接 `mongodb://localhost:27017/`，数据库默认 `user_profiles_db`，集合默认 `user`。外部 DKT/画像后端文档还要求 `practice`、`user_profiles` 集合。 |
| Python | 按功能需要 | 当前仓库未声明版本 | `README.md`、`api.md` | 仅在你需要启动仓库外的 Python 后端时需要；本仓库本身不包含这些 Python 源码。 |
| C 编译器（GCC/Clang） | 按功能需要 | 仓库未声明版本 | `src/server/review/run-c.ts` | 仅代码评审页“运行代码”功能需要。代码会按 `C_COMPILER`、`gcc`、`clang` 的顺序查找编译器。 |
| Java | 不需要 | 未发现依赖 | 全仓库代码检索 | 当前仓库没有 Java 代码或 `application.yml`。 |
| Go | 不需要 | 未发现依赖 | 全仓库代码检索 | 当前仓库没有 Go 代码。 |
| Redis | 不需要 | 未发现依赖 | 全仓库代码检索 | 当前仓库没有 Redis 配置或调用。 |
| PostgreSQL | 当前运行路径不需要 | `package.json` 中有 `pg` / `drizzle-*` 依赖，但未发现运行时代码引用 | 全仓库代码检索 | 当前仓库本地部署无需单独准备 PostgreSQL。 |

推荐理解方式：
- 只想把前端界面跑起来：需要 `Git + Node.js + pnpm`。
- 想让注册信息写入库、教师端拿到本地用户基础信息：再加 `MongoDB`。
- 想让练习、考试、画像代理功能可用：再加仓库外的 Python 后端。
- 想让代码评审页的“运行代码”可用：再加 `GCC` 或 `Clang`。

## 3. 如何获取代码

当前仓库实际远程地址：`https://github.com/abligail/code-pulse`

### 3.1 HTTPS

```powershell
git clone https://github.com/abligail/code-pulse.git
cd code-pulse
```

### 3.2 SSH

```powershell
git clone git@github.com:abligail/code-pulse.git
cd code-pulse
```

说明：
- SSH 地址是按当前 GitHub 仓库的标准 SSH 形式推导出来的。
- 如果你本机还没配置 GitHub SSH Key，请优先使用 HTTPS。

## 4. 项目目录说明

当前仓库关键目录和关键文件如下：

```text
code-pulse/
├─ public/                         # 静态资源
├─ scripts/                        # Bash 脚本（原生 Windows PowerShell 不推荐直接用）
├─ src/
│  ├─ app/                         # Next.js App Router 页面与 API 路由
│  │  ├─ auth/                     # 登录、注册
│  │  ├─ student/                  # 学生端页面：chat / review / practice / exam / report
│  │  ├─ teacher/                  # 教师端页面：dashboard / requirements
│  │  └─ api/                      # 本地 API 路由：mock / 代理 / 本地服务逻辑
│  ├─ components/                  # 业务组件与通用 UI 组件
│  ├─ hooks/                       # 自定义 Hooks
│  ├─ lib/
│  │  ├─ api/                      # 前端接口封装
│  │  ├─ auth/                     # localStorage 会话逻辑
│  │  ├─ mock-data.ts              # Mock 数据
│  │  └─ storage/                  # 本地存储辅助逻辑
│  └─ server/
│     ├─ mongodb/                  # MongoDB 连接与集合访问
│     └─ review/                   # C 代码运行、规则评审、画像同步
├─ .env.local                      # 本地环境变量（被 .gitignore 忽略，fresh clone 通常没有）
├─ .npmrc                          # npm/pnpm 源与安装策略
├─ api.md                          # 外部 DKT 后端接口说明
├─ README.md                       # 项目说明
├─ next.config.ts                  # Next.js 配置
├─ package.json                    # 依赖、脚本、包管理器约束
└─ pnpm-lock.yaml                  # pnpm 锁文件
```

建议重点关注这些文件：
- `package.json`
  - 确认 `pnpm`、脚本入口、核心依赖版本。
- `.env.local`
  - 当前工作区已有本地环境变量示例，但该文件不纳入 Git。
- `src/app/api/practice/shared.ts`
  - 定义练习/考试代理的上游地址来源。
- `src/server/mongodb/client.ts`
  - 定义本地 MongoDB 默认连接参数。
- `src/server/review/run-c.ts`
  - 定义 C 编译器、超时、输出限制等行为。
- `src/app/api/profile/events/route.ts`
  - 事件存储只在内存里，重启服务后会清空。

## 5. 环境配置

### 5.1 当前仓库里有哪些环境配置文件

当前仓库情况如下：
- 有 `.env.local`。
- 没有 `.env.example`。
- 没有 `application.yml`、`application.properties` 之类的 Java 配置文件。
- `.gitignore` 明确忽略 `.env.local`，所以第一次克隆后通常需要手动创建。

### 5.2 Windows 下创建 `.env.local`

在项目根目录执行：

```powershell
@'
DKT_API_BASE=http://localhost:8000
MONGODB_PROFILE_API_BASE=http://127.0.0.1:5000
'@ | Set-Content -Path .env.local -Encoding UTF8
```

这是当前工作区实际存在的两个核心变量，也是最值得保留的默认值。

### 5.3 哪些配置必须修改

必须修改与否，取决于你是否真的启动了对应上游服务：

| 配置项 | 是否必须 | 默认行为 / 当前值 | 何时需要修改 | 作用 |
| --- | --- | --- | --- | --- |
| `DKT_API_BASE` | 完整联调时必须确认 | 当前 `.env.local` 为 `http://localhost:8000`；代码默认也是 `8000` | 当你的题库/练习/考试后端不在 `8000` 端口时 | 供 `/api/practice/*`、部分画像代理调用上游服务。 |
| `MONGODB_PROFILE_API_BASE` | 完整联调时必须确认 | 当前 `.env.local` 为 `http://127.0.0.1:5000`；部分代码默认 `5000` | 当你的画像服务不在 `5000` 端口，或你把画像接口与 DKT 后端部署到同一个地址时 | 供 `/api/user-profile/*`、`/api/mongodb/user_profiles`、代码评审画像同步使用。 |
| `MONGO_URI` | 仅本地 MongoDB 功能需要 | 默认 `mongodb://localhost:27017/` | 当 MongoDB 不在本机默认地址时 | 本地 `/api/mongodb/users` 连接 MongoDB。 |
| `MONGO_DB_NAME` | 可选 | 默认 `user_profiles_db` | 当你要改数据库名时 | 本地 `/api/mongodb/users` 使用的数据库名。 |
| `MONGO_COLLECTION_NAME` | 可选 | 默认 `user` | 当你要改集合名时 | 本地 `/api/mongodb/users` 使用的集合名。 |
| `C_COMPILER` | 仅代码运行功能需要 | 不设置时自动尝试 `gcc`、`clang` | 当编译器不在 PATH 中时 | 指定 GCC/Clang 的完整路径。 |
| `COZE_API_TOKEN` / `COZE_API_PAT` | 可选 | 未设置时，`src/app/api/practice/analysis/route.ts` 中存在硬编码回退值 | 当你需要使用自己的 Coze Token 时 | 供练习解析接口调用 Coze workflow。 |
| `REVIEW_COMPILE_TIMEOUT_MS` | 可选 | 默认 `6000` | 需要调整编译超时时 | 代码评审编译超时阈值。 |
| `REVIEW_RUN_TIMEOUT_MS` | 可选 | 默认 `3000` | 需要调整运行超时时 | 代码评审运行超时阈值。 |
| `REVIEW_MAX_OUTPUT_BYTES` | 可选 | 默认 `65536` | 需要调整输出上限时 | 代码运行输出最大字节数。 |
| `PROFILE_SYNC_TIMEOUT_MS` | 可选 | 默认 `5000` | 画像服务响应慢时 | 代码评审同步画像的请求超时。 |
| `PROFILE_API_BASE_URL` | 可选 | 代码中作为备用值使用 | 只有你想统一复用备用变量时 | 多个代理路由会读这个备用地址。 |

### 5.4 推荐的两种 `.env.local` 模式

#### 模式 A：只跑前端最小可用界面

```powershell
@'
DKT_API_BASE=http://localhost:8000
MONGODB_PROFILE_API_BASE=http://127.0.0.1:5000
'@ | Set-Content -Path .env.local -Encoding UTF8
```

说明：
- 即使 `8000` 和 `5000` 的外部后端没有启动，前端页面大部分也能打开。
- 但练习、考试、画像代理等依赖上游服务的功能会失败。

#### 模式 B：本地完整联调

```powershell
@'
DKT_API_BASE=http://localhost:8000
MONGODB_PROFILE_API_BASE=http://127.0.0.1:5000
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=user_profiles_db
MONGO_COLLECTION_NAME=user
# 如果 gcc 不在 PATH 中，可显式指定
# C_COMPILER=C:\msys64\ucrt64\bin\gcc.exe
# 建议自行覆盖，不要长期依赖代码中的默认 Token
# COZE_API_TOKEN=your_token_here
'@ | Set-Content -Path .env.local -Encoding UTF8
```

### 5.5 修改环境变量后是否需要重启

需要。

修改 `.env.local` 后，请停止当前的 Next.js 进程，再重新启动：

```powershell
pnpm exec next dev -p 5002
```

## 6. 安装依赖

### 6.1 安装 pnpm（推荐做法）

项目要求使用 `pnpm`，不要使用 `npm install` 或 `yarn install`。

推荐先启用 `corepack`：

```powershell
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm -v
```

如果你的机器上 `corepack` 不可用，或者因为权限问题无法激活，可以改用全局安装：

```powershell
npm install -g pnpm@9
pnpm -v
```

### 6.2 安装前端依赖

在项目根目录执行：

```powershell
pnpm install
```

说明：
- `.npmrc` 已配置 `https://registry.npmmirror.com` 作为 registry。
- `package.json` 中有 `preinstall: npx only-allow pnpm`，所以如果你误用 `npm install`，安装会被拦截。

### 6.3 Windows 环境下不要直接用的脚本

以下命令在原生 Windows PowerShell 下不推荐作为首选：

```powershell
pnpm run dev
pnpm run build
pnpm run start
```

原因：
- 这些脚本最终会执行 `bash ./scripts/*.sh`。
- 仓库脚本适合 macOS/Linux/WSL/Git Bash，不适合“只考虑 Windows”的原生命令环境。

Windows PowerShell 请改用：

```powershell
pnpm exec next dev -p 5002
pnpm exec next build
pnpm exec next start -p 5002
```

## 7. 数据库准备

### 7.1 是否必须准备数据库

结论分两种：
- 只跑前端界面：数据库不是硬性前置条件。
- 想让本地 MongoDB 用户信息、教师端用户基础信息、外部 DKT/画像联调可用：需要准备 MongoDB。

### 7.2 当前仓库自身对 MongoDB 的要求

当前仓库本地代码只直接写一个集合：
- 连接地址默认：`mongodb://localhost:27017/`
- 数据库默认：`user_profiles_db`
- 集合默认：`user`

这个逻辑来自 `src/server/mongodb/client.ts`，对应接口是：
- `POST /api/mongodb/users`
- `GET /api/mongodb/users?id=...`

### 7.3 本仓库是否自带数据库初始化脚本

没有。

当前仓库没有发现以下内容：
- SQL 初始化脚本
- Mongo 初始化脚本
- 题库导入脚本
- `docker-compose.yml`

因此：
- 对于本地 `/api/mongodb/users` 这条链路，不需要专门导入数据；首次注册用户时，MongoDB 会自动创建数据库/集合。
- 对于练习/考试依赖的 `practice`、`user_profiles` 集合，当前仓库只在 `api.md` 中说明了外部后端的期望结构，但没有提供导入数据的方法。

### 7.4 启动 MongoDB（任选一种）

如果你已把 MongoDB 安装成 Windows 服务，可尝试：

```powershell
net start MongoDB
```

如果你是直接命令行启动 MongoDB，可使用：

```powershell
mongod --dbpath D:\data\db
```

如果目录还不存在，可先创建：

```powershell
New-Item -ItemType Directory -Force -Path D:\data\db
```

### 7.5 验证 MongoDB 是否可连

```powershell
mongosh "mongodb://localhost:27017" --eval "db.adminCommand({ ping: 1 })"
```

### 7.6 关于 `practice` 和 `user_profiles` 集合的说明

`api.md` 表明外部 DKT 后端默认会读取：
- 数据库：`user_profiles_db`
- 题库集合：`practice`
- 用户画像集合：`user_profiles`

但当前前端仓库没有附带这些集合的数据导入方式。因此：
- 如果你只部署当前前端仓库，本步骤无法单独完成题库初始化。
- 如果你要跑完整联调，需要同时准备仓库外的 Python 后端和它依赖的数据源。

## 8. 启动项目

### 8.1 推荐启动顺序

推荐顺序如下：
1. 启动 MongoDB（如果你要用本地用户基础信息功能）。
2. 启动画像服务（如果你有仓库外画像后端，并且 `MONGODB_PROFILE_API_BASE` 指向它）。
3. 启动 DKT 练习/考试后端（如果你要用练习、考试功能，并且 `DKT_API_BASE` 指向它）。
4. 启动前端 Next.js 服务。

### 8.2 启动前端开发环境

```powershell
pnpm exec next dev -p 5002
```

启动后浏览器访问：

```text
http://localhost:5002
```

说明：
- README 里推荐的端口也是 `5002`。
- 根路径 `/` 会自动根据 `localStorage` 中是否存在当前用户，跳转到 `/auth/login`、`/student/chat` 或 `/teacher/dashboard`。

### 8.3 启动前端生产预览

先构建：

```powershell
pnpm exec next build
```

再启动：

```powershell
pnpm exec next start -p 5002
```

### 8.4 仓库外后端的启动方式（仅当你需要完整联调）

#### 画像/联调后端

`README.md` 提到过一个仓库外目录：`graph-rag-prog-mind-finish/app`

```powershell
cd graph-rag-prog-mind-finish\app
python app.py
```

注意：
- 这个目录不在当前仓库中。
- 只有当你本机另外准备了该目录，上面命令才可执行。

#### DKT 后端

`api.md` 给出的启动方式如下：

```powershell
cd DKT_backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

注意：
- `DKT_backend` 也不在当前仓库中。
- 当前仓库只记录了它的接口说明和启动命令，没有包含其源码。

### 8.5 代码评审页的 C 编译器准备（仅当你要运行 C 代码）

先确认系统能找到 `gcc` 或 `clang`：

```powershell
gcc --version
```

或者：

```powershell
clang --version
```

如果命令找不到，但你已经装好了编译器，可以在 `.env.local` 里显式指定：

```powershell
@'
C_COMPILER=C:\msys64\ucrt64\bin\gcc.exe
'@ | Add-Content -Path .env.local -Encoding UTF8
```

然后重启前端服务：

```powershell
pnpm exec next dev -p 5002
```

## 9. 启动成功验证

### 9.1 前端页面验证

浏览器访问：

```text
http://localhost:5002
```

成功标志：
- 首次访问通常会跳转到 `/auth/login`。
- 可以打开注册页 `/auth/register` 并创建本地账号。
- 学生账号登录后可以看到 `chat`、`review`、`practice`、`exam`、`report`。
- 教师账号登录后可以看到 `dashboard`、`requirements`。

### 9.2 本地 API 基础验证

#### 验证教师看板 mock 接口

```powershell
Invoke-RestMethod -Uri "http://localhost:5002/api/teacher/dashboard"
```

预期：返回 JSON，而不是 404/500。

#### 验证本地用户画像 mock 接口

```powershell
Invoke-RestMethod -Uri "http://localhost:5002/api/profile/me"
```

预期：返回 JSON，而不是 404/500。

#### 验证本地事件接口

```powershell
Invoke-RestMethod -Uri "http://localhost:5002/api/profile/events"
```

预期：返回类似下面的结构：

```json
{
  "events": []
}
```

说明：
- 这个接口是内存数组实现。
- 只要 Next.js 进程重启，事件数据就会清空。

### 9.3 MongoDB 链路验证（可选）

先在网页中完成一次注册，拿到生成的 `userId`，再执行：

```powershell
Invoke-RestMethod -Uri "http://localhost:5002/api/mongodb/users?id=把这里替换成你的userId"
```

预期：返回结构中 `users` 数组里包含刚刚注册的用户。

### 9.4 外部 DKT 后端验证（可选）

`api.md` 中提供了健康检查接口：

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
```

预期：

```json
{
  "status": "ok"
}
```

### 9.5 画像服务验证（可选）

如果你的画像服务地址就是 `.env.local` 中的 `MONGODB_PROFILE_API_BASE`，可执行：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/mongodb/user_profiles?only_weak=true"
```

预期：返回 JSON，而不是连接失败或 502。

### 9.6 代码评审页验证（可选）

打开页面：

```text
http://localhost:5002/student/review
```

成功标志：
- 页面能正常展示示例 C 代码。
- 点击“运行代码”后，如果编译器可用，应出现“运行成功”或明确的编译/运行错误提示。
- 如果页面提示“当前环境未配置 C 编译器，无法执行代码”，说明前端服务正常，但本机尚未配置 `gcc` 或 `clang`。

## 10. 常见问题排查

### 10.1 `pnpm` 命令不存在

现象：
- PowerShell 提示 `pnpm is not recognized`。

处理：

```powershell
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm -v
```

如果仍失败：

```powershell
npm install -g pnpm@9
pnpm -v
```

### 10.2 误用了 `npm install`

现象：
- 安装阶段被 `only-allow pnpm` 拦截。

处理：

```powershell
pnpm install
```

### 10.3 在 Windows PowerShell 里执行 `pnpm run dev` 失败

原因：
- `package.json` 里的 `dev/build/start` 实际执行的是 `bash ./scripts/*.sh`。

处理：

```powershell
pnpm exec next dev -p 5002
```

构建与生产预览分别使用：

```powershell
pnpm exec next build
pnpm exec next start -p 5002
```

### 10.4 端口被占用

检查端口占用：

```powershell
Get-NetTCPConnection -LocalPort 5002,5000,8000,27017 -ErrorAction SilentlyContinue | Select-Object LocalPort,State,OwningProcess
```

查看进程：

```powershell
Get-Process -Id 这里替换成OwningProcess返回的PID
```

结束进程：

```powershell
Stop-Process -Id 这里替换成PID -Force
```

### 10.5 Node.js 或 pnpm 版本不匹配

核对版本：

```powershell
node -v
pnpm -v
```

要求：
- Node.js 至少 `20+`
- pnpm 至少 `9+`

### 10.6 环境变量修改后不生效

原因：
- Next.js 在进程启动时读取 `.env.local`，不是热更新读取。

处理：

```powershell
pnpm exec next dev -p 5002
```

如果你已经在运行开发服务，请先停止当前进程，再重新执行上面的命令。

### 10.7 MongoDB 连接失败

先确认 MongoDB 在监听：

```powershell
mongosh "mongodb://localhost:27017" --eval "db.adminCommand({ ping: 1 })"
```

如果你的 MongoDB 地址不是默认值，请把 `.env.local` 改成实际地址：

```powershell
@'
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=user_profiles_db
MONGO_COLLECTION_NAME=user
'@ | Add-Content -Path .env.local -Encoding UTF8
```

然后重启前端服务。

### 10.8 练习/考试页面报 502 或“获取题目失败”

原因：
- `/api/practice/*` 会把请求转发到 `DKT_API_BASE`。
- 如果 `DKT_API_BASE` 指向的服务没启动，前端就会收到代理失败。

先检查外部 DKT 后端健康状态：

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
```

如果你的端口不是 `8000`，请修改 `.env.local`：

```powershell
@'
DKT_API_BASE=http://localhost:8000
'@ | Set-Content -Path .env.local -Encoding UTF8
```

然后重启前端服务。

### 10.9 教师画像或用户画像代理报 502

原因：
- `/api/user-profile/*`、`/api/mongodb/user_profiles`、代码评审画像同步都会访问 `MONGODB_PROFILE_API_BASE`。

先确认上游画像服务地址可访问：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/mongodb/user_profiles?only_weak=true"
```

如果地址不对，修改 `.env.local`：

```powershell
@'
MONGODB_PROFILE_API_BASE=http://127.0.0.1:5000
'@ | Set-Content -Path .env.local -Encoding UTF8
```

然后重启前端服务。

### 10.10 代码评审页提示没有可用的 C 编译器

原因：
- `src/server/review/run-c.ts` 只会按顺序查找 `C_COMPILER`、`gcc`、`clang`。

先验证 PATH：

```powershell
gcc --version
```

如果 PATH 里没有，但你知道编译器安装路径，就在 `.env.local` 里指定：

```powershell
@'
C_COMPILER=C:\msys64\ucrt64\bin\gcc.exe
'@ | Add-Content -Path .env.local -Encoding UTF8
```

然后重启前端服务。

### 10.11 `corepack` 或 `next build` 在 Windows 下出现 `EPERM` / `spawn EPERM`

可能原因：
- 当前用户对某些缓存目录没有写权限。
- 杀毒软件或系统策略阻止子进程创建。
- 从受限目录启动构建导致进程创建失败。

建议排查：

```powershell
corepack prepare pnpm@9.0.0 --activate
```

如果失败，改用：

```powershell
npm install -g pnpm@9
```

如果 `next build` 仍出现 `spawn EPERM`，优先检查：
- 是否在普通可写目录中运行项目。
- 是否有安全软件阻止 Node.js 创建子进程。
- 是否用管理员权限重新打开 PowerShell 后再试。

### 10.12 为什么注册成功了，但有些数据重启后丢失

这是当前仓库的代码行为，不是部署错误：
- 登录态和最近账号保存在浏览器 `localStorage`。
- `/api/profile/events` 使用内存数组，Next.js 服务重启后会清空。
- chat、教师要求、部分看板数据本来就是 mock。

如果你需要稳定持久化，需要补齐仓库外的真实后端与数据库链路。

## 补充结论

如果你是第一次接触项目，推荐按下面顺序操作：
1. 安装 `Node.js 20+`。
2. 安装并启用 `pnpm 9+`。
3. 克隆仓库并创建 `.env.local`。
4. 执行 `pnpm install`。
5. 执行 `pnpm exec next dev -p 5002`。
6. 先验证登录、聊天、教师看板 mock 页面能否打开。
7. 再按需补 MongoDB、画像服务、DKT 后端、C 编译器。

这样最稳，也最符合当前仓库代码的真实依赖边界。
