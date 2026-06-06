# 面试答题网站 - 全面代码审查报告

> 审查日期：2026-06-05 | 审查范围：全项目代码 | 审查目标：消除逻辑错误、优化结构、提升用户体验

---

## 一、严重问题（必须修复）

### 1.1 【严重】JWT Secret 使用硬编码默认值

**位置**：`src/lib/auth.ts:4`

```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'
```

**风险**：如果环境变量未设置，使用默认密钥，攻击者可轻松伪造 JWT Token。

**修复**：
```typescript
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required')
}
```

---

### 1.2 【严重】API 路由缺少错误详情返回

**位置**：多处 API 路由

**问题**：所有 API 的 catch 块只返回通用错误消息，不记录具体错误，导致生产环境难以排查问题。

**示例**：`src/app/api/evaluate/route.ts:68-73`
```typescript
catch (error) {
  console.error('Evaluate error:', error)
  return NextResponse.json(
    { error: '批改失败，请稍后重试' },
    { status: 500 }
  )
}
```

**修复建议**：保留错误日志，但返回给客户端的消息保持通用（安全考虑），同时增加错误追踪 ID。

---

### 1.3 【严重】前端 localStorage token 检查不一致

**位置**：多个页面组件

**问题**：每个页面都独立检查 token，代码重复且存在竞态条件。例如 `page.tsx` 和 `profile.tsx` 都直接读取 localStorage，没有统一的认证状态管理。

**修复建议**：创建 AuthContext 或使用全局状态管理认证状态。

---

## 二、逻辑错误（需要修复）

### 2.1 【逻辑】真题列表页筛选后分页未重置

**位置**：`src/app/zhenti/page.tsx:76-77`

```typescript
useEffect(() => {
  // ...
  fetchQuestions(1)
  setPage(1)  // 这里 setPage(1) 在 fetchQuestions(1) 之后
}, [selectedYear, selectedCategory, selectedType, fetchQuestions, router])
```

**问题**：`fetchQuestions` 依赖 `page` 状态，但这里先调用 `fetchQuestions(1)` 再 `setPage(1)`，虽然传了参数 1，但 `fetchQuestions` 内部使用参数 `p`，不影响。不过 `setPage(1)` 应该在 `fetchQuestions` 之前或同时，避免状态不一致。

**实际风险**：低，因为 `fetchQuestions` 接收参数不使用 `page` state。

---

### 2.2 【逻辑】真题详情页 useEffect 依赖缺失

**位置**：`src/app/zhenti/[id]/page.tsx:77`

```typescript
useEffect(() => {
  const token = localStorage.getItem('token')
  if (!token) { router.push('/login'); return }
  fetchDetail()
}, [id])
```

**问题**：`fetchDetail` 没有在依赖数组中，虽然它定义在组件内且使用了 `id`，但如果 `fetchDetail` 内部依赖了其他状态可能导致闭包问题。

**修复**：
```typescript
useEffect(() => {
  const token = localStorage.getItem('token')
  if (!token) { router.push('/login'); return }
  fetchDetail()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [id, router])
```

---

### 2.3 【逻辑】套题作答页答案保存逻辑缺陷

**位置**：`src/app/practice/set/[mode]/answer/page.tsx:90-95`

```typescript
const handleSaveAnswer = () => {
  if (!currentQuestion) return
  const newAnswers = { ...userAnswers, [currentQuestion.index]: currentAnswer }
  setUserAnswers(newAnswers)
  localStorage.setItem(`setAnswers_${mode}`, JSON.stringify(newAnswers))
}
```

**问题**：`currentAnswer` 可能为空字符串，但也会保存到 localStorage，导致"已作答"判断错误。

**修复**：
```typescript
const handleSaveAnswer = () => {
  if (!currentQuestion) return
  if (currentAnswer.trim()) {
    const newAnswers = { ...userAnswers, [currentQuestion.index]: currentAnswer.trim() }
    setUserAnswers(newAnswers)
    localStorage.setItem(`setAnswers_${mode}`, JSON.stringify(newAnswers))
  }
}
```

---

### 2.4 【逻辑】语音组件中 stopRecording 循环调用风险

**位置**：`src/components/VoiceInput.tsx:245-248, 299-305`

```typescript
// 在 timer 中
if (elapsed * 1000 >= MAX_DURATION) {
  stopRecording()  // 这会触发 ws.onclose
}

// ws.onclose 中
stopRecording()  // 再次调用 stopRecording
```

**问题**：超时自动停止时，`stopRecording` 被调用，导致 `ws.close()`，触发 `onclose`，`onclose` 中又调用 `stopRecording`，形成循环调用。虽然 `stopAliyunRecording` 中有状态检查，但 `stopRecording` 是 wrapper，可能重复执行。

**修复**：在 `stopAliyunRecording` 开头增加 isRecording 状态检查：
```typescript
const stopAliyunRecording = useCallback(() => {
  if (!isRecording) return  // 防止重复调用
  // ...
}, [isRecording, cleanup, onTranscript])
```

---

### 2.5 【逻辑】AudioUploader 中 Token 复用问题

**位置**：`src/components/AudioUploader.tsx:250-260`

```typescript
// 复用第1段获取的Token（阿里云Token有效期10分钟，足够覆盖全部分段）
let segToken: string
let segAppKey: string
if (segIdx === 0) {
  segToken = tokenData.token
  segAppKey = tokenData.appKey
} else {
  // 如果Token失效才重新获取（通常不需要）
  segToken = tokenData.token
  segAppKey = tokenData.appKey
}
```

**问题**：注释说 Token 有效期 10 分钟，但如果音频很长（如 8 分钟 = 16 段，每段处理时间不确定），Token 可能过期。

**修复**：在循环中检查 Token 剩余时间，或每 5 分钟重新获取一次。

---

### 2.6 【逻辑】每日新闻日期使用本地时区可能出错

**位置**：`src/app/daily-news/page.tsx:63`

```typescript
const today = new Date().toISOString().split('T')[0]
```

**问题**：`toISOString()` 返回 UTC 时间，如果用户在 UTC+8 时区的晚上 8 点访问，可能得到的是第二天的日期。

**修复**：
```typescript
const today = new Date().toLocaleDateString('zh-CN', { 
  year: 'numeric', 
  month: '2-digit', 
  day: '2-digit' 
}).replace(/\//g, '-')
```

---

### 2.7 【逻辑】真题详情页 JSON.parse 无错误处理

**位置**：`src/app/api/zhenti/detail/[id]/route.ts:45`

```typescript
comparison: JSON.parse(question.comparison || '{}'),
```

**问题**：如果 `comparison` 字段存储了非法 JSON，会导致 500 错误。

**修复**：
```typescript
let comparison = {}
try {
  comparison = JSON.parse(question.comparison || '{}')
} catch {
  comparison = {}
}
```

---

## 三、性能问题（建议优化）

### 3.1 【性能】真题列表 API 重复查询

**位置**：`src/app/api/zhenti/list/route.ts`

**问题**：每次请求列表时，都会同时查询 years、categories、types，这些筛选器数据变化频率极低，但每次都查询数据库。

**优化**：将筛选器数据缓存到内存或 Redis，每小时更新一次。

---

### 3.2 【性能】前端组件重复渲染

**位置**：`src/app/zhenti/page.tsx`

**问题**：`grouped` 对象在每次渲染时重新计算，虽然数据量不大，但可以用 `useMemo` 优化。

**修复**：
```typescript
const grouped = useMemo(() => {
  return displayedQuestions.reduce<Record<string, ZhentiItem[]>>((acc, q) => {
    const key = q.examTitle
    if (!acc[key]) acc[key] = []
    acc[key].push(q)
    return acc
  }, {})
}, [displayedQuestions])
```

---

### 3.3 【性能】套题训练顺序生成答案

**位置**：`src/app/practice/set/[mode]/page.tsx:66-87`

**问题**：`handleShowAnswers` 使用 `for...of` 顺序请求，没有并行化。

**优化**：
```typescript
const newAnswers: Record<number, string> = {}
await Promise.all(setData.questions.map(async (q) => {
  const res = await fetch('/api/answers/generate', { ... })
  const data = await res.json()
  newAnswers[q.index] = data.answer || '生成失败'
}))
```

**注意**：并行请求可能触发 API 限流，需要评估。

---

### 3.4 【性能】图片题无懒加载

**位置**：`src/app/zhenti/[id]/page.tsx:238-244`

```typescript
<img
  src={question.imageUrl}
  alt="题目配图"
  className="max-w-full rounded-lg border border-slate-200"
  style={{ maxHeight: '400px' }}
/>
```

**问题**：图片直接加载，没有懒加载或 loading 占位。

**修复**：增加 loading 状态和错误处理：
```typescript
const [imageLoaded, setImageLoaded] = useState(false)
const [imageError, setImageError] = useState(false)

{question.imageUrl && !imageError && (
  <div className="mt-4">
    {!imageLoaded && <div className="animate-pulse bg-slate-200 h-64 rounded-lg" />}
    <img
      src={question.imageUrl}
      alt="题目配图"
      className={`max-w-full rounded-lg border border-slate-200 ${imageLoaded ? '' : 'hidden'}`}
      style={{ maxHeight: '400px' }}
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageError(true)}
    />
  </div>
)}
```

---

## 四、代码质量问题（建议改进）

### 4.1 【质量】重复的类型定义

**位置**：多处

**问题**：`QuestionItem`、`SetData` 等类型在多个文件中重复定义。

**修复**：统一放到 `src/types/index.ts` 中。

---

### 4.2 【质量】魔法数字

**位置**：多处

**问题**：
- `MAX_DURATION = 6 * 60 * 1000`（VoiceInput.tsx）
- `pageSize = 20`（zhenti/list API）
- `RECENT_TOPICS_LIMIT = 25`（questions/generate API）

**修复**：提取为命名常量或配置项。

---

### 4.3 【质量】错误处理不一致

**位置**：前端页面

**问题**：有的用 `alert()`，有的用状态显示错误，有的直接忽略。

**建议**：统一错误处理机制，使用 toast 或全局错误边界。

---

### 4.4 【质量】缺少输入验证

**位置**：多个 API 路由

**问题**：例如 `zhenti/list` 的 `page` 和 `pageSize` 参数没有上限限制，可能导致数据库查询过大。

**修复**：
```typescript
const page = Math.min(parseInt(url.searchParams.get('page') || '1'), 100)
const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20'), 50)
```

---

### 4.5 【质量】TypeScript any 类型滥用

**位置**：`src/app/page.tsx:15`

```typescript
const [user, setUser] = useState<any>(null)
```

**修复**：定义 User 接口：
```typescript
interface UserInfo {
  id: string
  username: string
  nickname: string | null
}
```

---

## 五、用户体验问题（建议优化）

### 5.1 【UX】真题列表页缺少搜索功能

**问题**：198 道真题，用户只能通过年份/类别/题型筛选，无法按关键词搜索题目内容。

**建议**：增加搜索框，支持按题目内容关键词搜索。

---

### 5.2 【UX】真题详情页缺少答题功能

**问题**：真题详情页只能看答案，不能实际练习作答。

**建议**：复用 `AnswerRecorder` 组件，让用户可以在真题页直接语音/文字作答并保存。

---

### 5.3 【UX】练习记录页缺少删除功能

**问题**：用户无法删除不需要的练习记录。

**建议**：增加删除按钮和确认对话框。

---

### 5.4 【UX】加载状态不统一

**问题**：有的页面用 spinner，有的用文字，有的没有加载状态。

**建议**：统一加载组件。

---

### 5.5 【UX】缺少空状态引导

**位置**：`src/app/zhenti/page.tsx:183`

```typescript
<div className="text-center py-20 text-slate-400">暂无数据</div>
```

**问题**：空状态太简单，没有引导用户操作。

**修复**：增加引导文案和按钮。

---

## 六、安全问题（建议修复）

### 6.1 【安全】XSS 风险

**位置**：`src/app/daily-news/page.tsx` 中的新闻标题和简介直接渲染。

**问题**：如果新闻内容包含恶意脚本，可能导致 XSS。

**修复**：确保后端存储的新闻内容已经过清理，或使用 DOMPurify 前端净化。

---

### 6.2 【安全】API 未限制请求频率

**问题**：没有速率限制，可能被恶意刷 API。

**建议**：增加基于 IP 或用户 ID 的速率限制。

---

## 七、数据库优化建议

### 7.1 索引优化

**当前索引**：
```prisma
@@index([examYear])
@@index([examDate])
```

**建议增加**：
```prisma
@@index([examCategory])
@@index([questionType])
@@index([examYear, examCategory])  // 复合索引，覆盖常见查询
```

---

### 7.2 字段长度优化

**问题**：`questionText`、`answer1/2/3`、`finalAnswer` 等字段使用默认长度，可能存储大量文本。

**建议**：明确使用 `@db.Text` 类型：
```prisma
questionText String @db.Text
answer1      String @db.Text
```

---

## 八、总结

| 类别 | 数量 | 优先级 |
|------|------|--------|
| 严重问题 | 3 | P0 - 必须立即修复 |
| 逻辑错误 | 7 | P1 - 尽快修复 |
| 性能问题 | 4 | P2 - 建议优化 |
| 代码质量 | 5 | P2 - 建议改进 |
| 用户体验 | 5 | P2 - 建议优化 |
| 安全问题 | 2 | P1 - 建议修复 |

**最高优先级修复项**：
1. JWT Secret 硬编码（安全）
2. 语音组件循环调用风险（稳定性）
3. API 错误处理不完善（可维护性）
4. 日期时区问题（功能正确性）
5. JSON.parse 无错误处理（稳定性）
