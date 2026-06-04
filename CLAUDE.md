# CLAUDE.md - 项目规则

## 核心技术栈
Next.js 14 + React 18 + TypeScript + Tailwind + Prisma + Neon PostgreSQL（生产）/ SQLite（本地dev）+ DeepSeek API + 阿里云语音识别

## 核心功能
AI出题(8题型)→AI参考答案→AI批改(六维度+改进版答案)→自定义题目(答题+批改)→套题训练(邀请用户)→用户系统+练习记录

### 额度（src/lib/quota.ts）
- 免费：每日5次（出题不扣，答案/批改扣）
- 邀请制：邀请码激活(month+30d / year+365d)，有效期内无限次

### 每日政务要闻
- 主触发：cron-job.org 每天19:05（北京时间）
- 备用：Vercel Cron 每天11:00 UTC（防重复机制）
- 信源：江苏省政府网等6站，评分：相关度40%+政策25%+时效20%+密度15%
- 前端：`/daily-news`
- ⚠️ API路由必须 `export const dynamic = 'force-dynamic'`（防边缘缓存导致日期错误）

### 语音答题（阿里云方案）
- 服务端Token(`@alicloud/pop-core`) + 前端WebSocket
- 实时流式输出：RecognitionResultChanged 即时传给父组件
- 增量模式（防重复）：getIncrementalText 最长公共后缀算法，非简单startsWith
- 蓝色预览框：父组件渲染，自动 scrollTop=scrollHeight 始终显示最新文字
- 文件：`VoiceInput.tsx`（实时麦克风）+ `AudioUploader.tsx`（上传录音文件）+ `api/voice/aliyun-token/route.ts`
- AudioUploader：Web Audio API解码音频 → 重采样16000Hz → 30秒分片 → WebSocket分块发送（严格按实时速率）
- 降级：浏览器原生Web Speech API

## 答题风格（硬约束）
- 口头化，**禁用数字编号**（1.2.3./(1)(2)(3)/①②③）
- 过渡词：首先…其次…最后…
- 答案结构：【答题大纲】50-100字 + 【详细答案】

## 环境变量
DATABASE_URL / JWT_SECRET / DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_APP_KEY

## 路径速查
| 用途 | 路径 |
|------|------|
| API路由 | `src/app/api/` |
| 核心组件 | `src/components/` |
| 工具函数 | `src/lib/` |
| 数据库模型 | `prisma/schema.prisma` |
| Vercel Cron | `vercel.json` → `api/cron/fetch-news` |
| 认证 | `src/lib/auth.ts`（requireAuth / getAuthHeaders） |
| 邀请码生成 | `scripts/generate-invite-codes-neon.js` |

## 本地开发
```bash
npm run dev            # 启动（端口3000/3001）
npx prisma studio      # 数据库管理
```
- 数据库：`.env` 设 `DATABASE_URL=Neon URL`（直连线上库）
- API Key：`.env` 需配 `DEEPSEEK_API_KEY`

## 红线
- `.env` **绝不提交GitHub**
- 用户请求Git操作时只提供命令，不自动推送
- 工作流：先分析需求→列出改动范围→确认后编码
