# 代码审查报告

## 审查时间：2026-06-07
## 审查范围：全站代码（API路由、前端组件、数据库、工具函数）
## 项目技术栈：Next.js 14 + TypeScript + Prisma + Neon PostgreSQL

---

## 一、严重问题（Critical）

### 1. 套题训练未扣除额度
**位置**：`src/app/api/questions/set-generate/route.ts`
**问题**：生成套题时只检查了 `checkAccess`（邀请用户权限），但没有调用 `checkQuota` 和 `deductQuota`。虽然邀请用户有无限额度，但代码路径上没有额度扣除逻辑，且普通用户理论上不应到达此处（被 access 拦截），但如果权限校验逻辑变更或出现漏洞，会导致额度系统被绕过。
**影响**：额度控制不完整，存在潜在的额度绕过风险。
**修复**：在生成套题前调用 `checkQuota`，生成后调用 `deductQuota`，保持与其他 API 一致的额度控制模式。

### 2. 新闻 API JSON.parse 缺少错误保护
**位置**：`src/app/api/news/daily/route.ts` 第27-28行
**问题**：
```typescript
topNews: JSON.parse(news.topNews),
allNews: news.allNews ? JSON.parse(news.allNews) : [],
```
如果数据库中存储的 JSON 字符串损坏，会直接抛出 500 错误。
**影响**：服务不可用。
**修复**：包装在 try-catch 中，解析失败时返回空数组并记录错误日志。

### 3. 注册时邀请码使用缺少事务保护
**位置**：`src/app/api/auth/register/route.ts` 第47-66行
**问题**：先查询邀请码，再更新邀请码状态，最后创建用户。这三个操作不在同一个事务中。
**影响**：高并发下可能出现同一个邀请码被多个用户同时使用的情况。
**修复**：将邀请码查询、更新和用户创建包装在 Prisma 事务中。

---

## 二、警告问题（Warning）

### 4. 前端错误静默处理
**位置**：多个前端页面
- `src/app/page.tsx`：`.catch(() => {})` 在获取额度信息时完全静默
- `src/app/history/page.tsx`：`.catch(() => { setLoading(false) })` 只关闭 loading，不显示错误
- `src/app/zhenti/page.tsx`：`catch (err) { console.error(...); setLoading(false) }` 只控制台输出
- `src/app/zhenti/[id]/page.tsx`：`catch (err) { console.error(...); setLoading(false) }`
**影响**：用户遇到网络错误时页面可能一直 loading 或显示空白，没有任何错误提示。
**修复**：至少显示一个错误提示，如 `setError('加载失败，请稍后重试')`。

### 5. 日期时区处理不一致
**位置**：
- `src/app/api/cron/fetch-news/route.ts` 第334行：`new Date(now.getTime() + 8 * 60 * 60 * 1000)`
- `src/app/api/cron/check-news/route.ts` 第16、23行：同样的手动偏移
- `src/app/daily-news/page.tsx` 第65行：同样的手动偏移
**问题**：手动计算 UTC+8 时区偏移，在夏令时切换等边缘情况下可能出错。
**影响**：日期计算错误可能导致新闻数据重复或缺失。
**修复**：统一使用 `toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })` 或引入 dayjs 库。

### 6. API 响应格式不统一
**位置**：全站 API
**问题**：
- 错误响应：有的用 `{ error: string }`，有的用 `{ message: string }`
- 成功响应：有的直接返回数据，有的包装在 `{ success: true, data: ... }` 中
**影响**：前端需要针对不同的 API 写不同的错误处理逻辑。
**修复**：统一响应格式，如 `{ success: boolean, data?: any, error?: string }`。

### 7. 未使用的依赖
**位置**：`package.json`
**问题**：`@neondatabase/serverless` 包已安装但代码中未直接使用（通过 Prisma 间接使用）。
**影响**：增加构建体积和依赖风险。
**建议**：检查并清理未使用的依赖。

### 8. 类型定义重复
**位置**：
- `src/app/practice/set/[mode]/page.tsx` 中定义了 `QuestionItem`、`SetData`
- `src/lib/docx-export.ts` 中也定义了相同的 `QuestionItem`、`SetData`
- `src/app/practice/set/[mode]/answer/page.tsx` 和 `result/page.tsx`（如果非空）也可能重复
**影响**：维护困难，类型不一致风险。
**修复**：提取到 `src/types/index.ts` 共享类型文件。

### 9. localStorage 键名硬编码
**位置**：
- `src/app/practice/page.tsx`：`setTrainingData`、`setAnswers_${mode}`
- `src/app/practice/set/[mode]/page.tsx`：`setTrainingData`、`setAnswers_${mode}`、`setUserAnswers_${mode}` 等
**影响**：修改键名时容易遗漏，导致数据不一致。
**修复**：在常量文件中统一定义所有 localStorage 键名。

### 10. 阿里云 Token API 硬编码 fallback
**位置**：`src/app/api/voice/aliyun-token/route.ts` 第14行
**问题**：`appKey: process.env.ALIYUN_APP_KEY || 'CbQtvzJ4k8mmaRLS'`
**影响**：如果环境变量未设置，使用硬编码的 appKey，存在安全风险。
**修复**：移除 fallback，未设置时返回错误。

### 11. 套题答案生成串行请求
**位置**：`src/app/practice/set/[mode]/page.tsx` 第68-76行
**问题**：使用 `for...of` 循环串行调用 `/api/answers/generate`，每道题等待上一道完成。
**影响**：3道题需要 3 倍单题时间，用户体验差。
**修复**：使用 `Promise.all` 并行请求，或添加批量生成 API。

---

## 三、建议优化（Suggestion）

### 12. 组件代码重复
**位置**：`src/app/practice/page.tsx` 和 `src/app/custom-question/page.tsx`
**问题**：答题流程（题目展示、答案输入、批改结果）的 UI 和逻辑高度重复，包括：
- 参考答案展示卡片
- 用户答案输入框（含语音组件）
- 批改结果展示
- 操作按钮组
**建议**：提取为可复用的 `AnswerFlow` 组件。

### 13. 缺少加载状态统一处理
**位置**：全站
**问题**：各页面自行实现加载动画，样式不统一（有的用 spinner，有的只用文字）。
**建议**：创建统一的 `LoadingSpinner` 和 `ErrorMessage` 组件。

### 14. 图片加载无错误处理（已修复验证）
**位置**：`src/app/zhenti/[id]/page.tsx`
**现状**：已添加 `onError` 处理，图片加载失败时显示友好提示。
**状态**：已修复。

### 15. 历史记录无分页
**位置**：`src/app/api/history/route.ts`
**问题**：`findMany({ take: 50 })` 固定取最近 50 条，无分页参数。
**影响**：用户练习记录多时，前端只能显示 50 条。
**建议**：添加分页参数支持。

### 16. 真题列表筛选器数据重复查询
**位置**：`src/app/api/zhenti/list/route.ts` 第48-65行
**问题**：每次请求都查询 years、categories、types，即使这些筛选器数据很少变化。
**建议**：可缓存筛选器数据，或在前端首次加载后缓存。

### 17. 语音组件代码复杂度
**位置**：`src/components/VoiceInput.tsx`
**问题**：单文件超过 560 行，同时处理阿里云 WebSocket 和浏览器原生 SpeechRecognition 两种引擎。
**建议**：拆分为 `AliyunVoiceEngine` 和 `BrowserVoiceEngine` 两个独立模块。

### 18. 缺少输入长度限制
**位置**：`src/app/api/answers/generate/route.ts` 和 `src/app/api/custom-answer/route.ts`
**问题**：虽然 `evaluate` 有 5000 字限制，但 `answers/generate` 和 `custom-answer` 只有最小长度检查（5字/10字），没有最大长度限制。
**建议**：添加最大长度校验，防止超长文本导致 API 费用过高。

---

## 四、性能优化

### 19. 数据库索引
**位置**：`prisma/schema.prisma`
**现状**：
- `ZhentiQuestion` 已有 `examYear`、`examDate`、`examDate+examCategory` 索引
- `ZhentiBookmark` 已有 `userId` 索引
- `CronExecutionLog` 已有 `jobName+createdAt` 索引
**评估**：索引设计合理，覆盖了主要查询场景。

### 20. 真题详情页 N+1 问题
**位置**：`src/app/api/zhenti/detail/[id]/route.ts`
**现状**：
1. 查询题目详情
2. 查询收藏状态
3. 查询同场次题目（siblings）
**评估**：3 次查询都是必要的，且都有明确的 where 条件，不构成典型的 N+1 问题。但 siblings 查询可以用 `select` 只取需要的字段，已做到。

---

## 五、安全问题

### 21. JWT Secret 校验（已修复验证）
**位置**：`src/lib/auth.ts`
**现状**：
```typescript
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 环境变量未设置，请检查环境配置')
}
```
**状态**：已正确实现，未设置时直接抛错，不会使用默认值。

### 22. 邀请码验证缺少频率限制
**位置**：`src/app/api/invite/validate/route.ts`
**问题**：可以无限次尝试邀请码。
**建议**：添加速率限制，如每用户每小时最多尝试 10 次。

### 23. 密码哈希强度
**位置**：`src/app/api/auth/register/route.ts` 第34行
**现状**：`bcrypt.hash(password, 10)`，salt rounds 为 10。
**评估**：符合当前安全标准（推荐 10-12 轮）。

### 24. CORS 和请求来源校验
**位置**：全站 API
**问题**：API 路由没有校验请求来源（Origin/Referer）。
**影响**：存在 CSRF 风险，虽然使用 Bearer Token 有一定缓解。
**建议**：对于敏感操作（如邀请码激活），添加 CSRF Token 或校验 Origin 头。

---

## 六、代码质量

### 25. TypeScript 类型安全
**位置**：多处
**问题**：
- `src/app/api/zhenti/list/route.ts` 第21行：`const where: any = {}` 使用 `any` 类型
- `src/app/api/cron/fetch-news/route.ts` 多处使用 `any[]`
**建议**：使用更精确的类型定义。

### 26. 未使用的导入/变量
**位置**：需要运行 linter 检查
**建议**：配置 ESLint 自动检查未使用的导入和变量。

### 27. 环境变量使用
**位置**：`src/lib/ai.ts`
**现状**：
```typescript
const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DASHSCOPE_API_KEY
```
**评估**：有 fallback 机制，但建议明确优先级或统一使用一个环境变量。

---

## 七、构建和部署

### 28. next.config.js
**位置**：`next.config.js`
**现状**：
```javascript
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
}
```
**评估**：配置合理，`standalone` 输出适合 Docker 部署。

### 29. package.json 脚本
**位置**：`package.json`
**现状**：
```json
"build": "prisma generate && next build",
"postinstall": "prisma generate"
```
**评估**：脚本设计合理，确保 Prisma Client 在构建时生成。

### 30. 环境变量检查
**建议**：在应用启动时检查必需的环境变量是否设置：
- `DATABASE_URL`
- `JWT_SECRET`
- `DEEPSEEK_API_KEY` 或 `DASHSCOPE_API_KEY`
- `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET`（如果使用语音功能）

---

## 八、问题汇总表

| # | 问题 | 严重程度 | 文件 | 建议修复优先级 |
|---|------|---------|------|--------------|
| 1 | 套题训练未扣除额度 | Critical | `questions/set-generate` | P0 |
| 2 | 新闻 API JSON.parse 无保护 | Critical | `news/daily` | P0 |
| 3 | 注册邀请码缺少事务 | Critical | `auth/register` | P0 |
| 4 | 前端错误静默处理 | Warning | 多个页面 | P1 |
| 5 | 日期时区处理不一致 | Warning | cron/*, daily-news | P1 |
| 6 | API 响应格式不统一 | Warning | 全站 API | P2 |
| 7 | 未使用的依赖 | Warning | package.json | P2 |
| 8 | 类型定义重复 | Warning | practice/set/*, docx-export | P2 |
| 9 | localStorage 键名硬编码 | Warning | 多个页面 | P2 |
| 10 | 阿里云 appKey 硬编码 fallback | Warning | voice/aliyun-token | P1 |
| 11 | 套题答案串行生成 | Warning | practice/set/[mode] | P1 |
| 12 | 组件代码重复 | Suggestion | practice, custom-question | P3 |
| 13 | 缺少统一加载组件 | Suggestion | 全站 | P3 |
| 14 | 历史记录无分页 | Suggestion | history | P2 |
| 15 | 语音组件过于复杂 | Suggestion | VoiceInput.tsx | P3 |
| 16 | 缺少输入最大长度限制 | Suggestion | answers/generate, custom-answer | P2 |
| 17 | 邀请码缺少频率限制 | Security | invite/validate | P1 |
| 18 | 缺少 CSRF 防护 | Security | 全站 API | P2 |
| 19 | TypeScript any 类型 | Quality | zhenti/list, cron/* | P3 |

---

## 九、正面评价

1. **Prisma Client 单例模式**：`src/lib/db.ts` 正确实现了 Prisma Client 单例，避免重复实例化。
2. **JWT 安全**：`src/lib/auth.ts` 未设置 JWT_SECRET 时直接抛错，不使用默认值。
3. **事务使用**：`questions/generate` 和 `invite/validate` 正确使用了 Prisma 事务。
4. **图片错误处理**：`zhenti/[id]` 已添加 `onError` 回退处理。
5. **数据库索引**：Schema 中索引设计合理，覆盖了主要查询场景。
6. **AI 提示词工程**：`src/lib/ai.ts` 中的 prompt 设计非常专业，包含详细的评分维度和改进要求。
7. **语音增量算法**：`VoiceInput.tsx` 中的 `getIncrementalText` 算法设计巧妙，处理了语音识别结果的修正问题。
