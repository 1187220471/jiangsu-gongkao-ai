# 代码审查：历史包袱与认知成本

> 审查日期：2026-11-18 ｜ 基线：`0c2f847` ｜ 范围：`daijinli-web`（18,928 行）+ `daijinli-miniapp`（5,977 行）
> 方法：Git 全历史考古 + 结构/重复度扫描 + 新人接手路径核对。所有结论均可追溯到 commit 或文件行号。

---

## 结论摘要

三句话：

1. **没有整块死功能，但有四类真包袱**：失效配置、孤儿接口、过期文档、未清理的死字段。项目演进是「快速加功能 + 事后局部修补」，不是「边加边还债」。
2. **最大的风险不在代码，在运维面**：cron 接口无鉴权、`.env` 进过 git 历史、22 个 model 只有 13 张表有迁移。
3. **认知成本的主要来源不是复杂度，是「同一件事有多个版本」**：6 个题型副本、4 套数量口径、6 个品牌名、3 套 learnings、2 份代码审查报告。

---

# 第一部分：历史考古

## 1.1 项目演进：四个阶段，两次"大爆炸"

| 阶段 | 时间 | 提交占比 | 特征 |
|---|---|---|---|
| 起步 | 2026-05-11 | — | 一次提交 30+ 文件，Docker + SQLite 形态；同日转向 Vercel + Neon |
| 产品化爆发 | 2026-05 ~ 06-07 | **84%** | 邀请码、要闻、套题、语音（讯飞→阿里云同日替换）、真题、额度制 |
| 游戏化 + 双端 | 2026-07-20 ~ 08-21 | 5% | 补给站、专注、像素风、分享裂变；`c0edf9f` 一次 +2844 行迁移 6 个功能到 Web |
| 内容质量 | 2026-09-25 ~ 11-18 | 5% | 素材、要闻日期修复、五档改进版、PDF 试卷上传（`81937df` +3591 行） |

**判断**：两次"大爆炸"（`c0edf9f`、`81937df`）都是"一次性把整套功能搬进来"，没有配套的分层与测试。这是当前重复度的根源。

## 1.2 有意为之的设计（不要误判为包袱）

| 设计 | 为什么保留 |
|---|---|
| `TYPE_ALIASES`（`ai.ts:397`） | 兼容已发布的 **1.0.2 小程序客户端**，外部契约，不是 Web 端冗余 |
| `LEGACY_TYPE_MAP`（`shenlunTypes.ts:16`） | 兼容库里的旧题型字符串（观点分析/词句理解），删前需查库 |
| `dailyFreeCount` 字段名 | 名字像"次数"，实际存"半点单位"，是点数制重构后沿用（`quota.ts:10`） |
| `accessLevel` / `accessExpire` | "会员"字眼已去掉，但邀请权限系统仍在使用 |
| `public/pdf.worker.min.mjs`（1.4MB） | PDF 解析运行时依赖，删了上传功能直接坏 |
| `src/lib/ai.ts`（1183 行） | 耦合中心，不是死代码；但确实是最大改动风险点 |

## 1.3 历史遗留（可安全移除）

| 项 | 证据 | 为什么是包袱 |
|---|---|---|
| `next.config.js:5` `output: 'standalone'` | `cfc1b4f`（2026-05-11）为 Vercel 加；Docker 已于 `dce1e88` 删除 | Vercel 忽略它，本地 `next start` 反而告警，误导判断 |
| `next.config.js:4` `swcMinify` | Next 14 已默认开启，15 将移除 | 升级时会报配置无效 |
| `tsconfig.json` 无 `target` | 默认 ES5 + `lib: esnext` | 就是"Map 迭代报错"的根因（2026-11-18 实际踩到） |
| `@neondatabase/serverless` | 全仓 0 引用，`db.ts` 直接用 `PrismaClient` | 白装一个包 |
| `@types/uuid` | `uuid` 本身已移除 | 类型包孤悬 |
| `@types/bcryptjs` / `@types/jsonwebtoken` | dependencies 与 devDependencies 各一份 | `--production` 也会装类型包 |
| `/api/custom-answer`（47 行） | 与 `answers/generate` 逐行相同；调用方 2026-06-03 已改走新接口 | 多一个对外端点，语义重复 |
| `ai.ts:798` `answerQuestion()` | 0 调用，只是别名 | 让人误以为有第二条通道 |
| `ShenlunQuestion.referenceAnswer` | seed 永远写 `null`，UI 从不读 | 真正答案在 `ShenlunTeacherAnswer.teacherName='AI参考答案'` |
| `User.coins` / `Feedback.isRead` | 0 引用 | schema 里看着像有功能 |
| `daijinli-web.zip`（60KB） | 内含 `.env` + `prisma/dev.db` | **安全问题，不只是垃圾** |

## 1.4 为解决已不存在问题而引入的

| 项 | 引入背景 | 现在还需要吗 |
|---|---|---|
| `/api/cron/check-news` | 为 cron-job.org 非 2xx 告警 | **需确认 cron-job.org 后台是否仍在调用**，否则删了告警会静默消失 |
| `scripts/` 整体 gitignore | 2026-07-20 `d483e91` 为避免一次性脚本入库 | 但 `export-question-themes.ts` 等被 CLAUDE.md 当作工具入口 → 形成"文档指向不存在的文件"；2026-11-18 已因此导致 Vercel 构建失败 |
| `prisma/migrations/baseline` | SQLite → Postgres 的起点快照 | 22 个 model 只有 13 张表有迁移，`migrate deploy` 会得到半成品库 |

## 1.5 安全问题（独立于代码质量）

- `.env` 在 `9455d40`（初始提交）被提交，`1602eb9` 才移除。历史里含 `JWT_SECRET`、`DEEPSEEK_API_KEY`、`DASHSCOPE_API_KEY`（当时 `DATABASE_URL` 是 SQLite，无 Neon 凭据）。
- `daijinli-web.zip` 仍在 HEAD，内含 `.env`（301 B）与 `prisma/dev.db`（24KB）。
- **仅删 HEAD 文件不够**：历史仍可检出。需 ① 轮换上述密钥 ② 删除 zip ③ 评估是否用 `git filter-repo` 重写历史（会改变所有 commit hash，需全员重新 clone）。
- 待确认：GitHub 仓库是否 public。`gh` 未登录，无法自动判断。

---

# 第二部分：认知成本

## 2.1 新人第一天会卡在哪

| # | 障碍 | 证据 | 严重度 |
|---|---|---|---|
| 1 | **真正的文档不在仓库里** | `CLAUDE.md`、`.workbuddy/memory/`、`knowledge/` 全部在工作区根目录，根目录不是 git 仓库 | 致命 |
| 2 | **README 跑不起来** | 无 `npm install` / `npm run dev` / 本地数据库步骤；`.env.example` 缺 `DATABASE_URL` 与 3 个 `ALIYUN_*` | 致命 |
| 3 | **本地调试 = 直连生产库** | `.env` 的 `DATABASE_URL` 是 Neon 生产库；CLAUDE.md:117 承认 | 高 |
| 4 | **改计费必错** | `SCALE=2`、`dailyFreeCount` 默认 5（实为 2.5 点）、8 处单价散落、CLAUDE.md:10 写"出题不扣"但代码扣 0.5 | 高 |
| 5 | **`scripts/` 悖论** | 目录被 gitignore，但 CLAUDE.md 让你跑 `export-question-themes.ts`（未入库） | 中 |

## 2.2 同一件事的多个版本

| 概念 | 副本数 | 后果 |
|---|---|---|
| 题型映射 | **6 份**（`types/index.ts`、`practice/page.tsx`、`ai.ts`、`set-generate`、`zhenti/evaluate` 反向表、`interview/page.tsx`）+ 小程序 3 份 | 新增题型只改一处 → 静默回落成"社会现象类"（2026-09-28 已踩过） |
| 历史记录来源 | **3 处编码**：`questionType` 前缀 `shenlun-`、`question` 前缀 `[真题#`、其余归面试 | 改编码格式 = 静默归类错误，无类型检查 |
| 评分配色阈值 | **4 份**（80/60 三份，真题 85/75 一份） | 同一分数两端显示不同颜色 |
| 品牌名 | **6 个**：戴锦鲤 / 独行侠波铁 / 江苏公考AI / 申面智能小助手 / js-gongkao-web / mianshidati | 搜"项目叫什么"得到 6 个答案 |
| 代码审查报告 | 2 份（`CODE_REVIEW.md` 507 行 + `code-review-report.md` 283 行） | 且 `CODE_REVIEW.md` 的 JWT 建议与 CLAUDE.md 红线**直接冲突** |
| learnings | 4 套（根 + web + web/.workbuddy + miniapp） | 记在哪全靠猜 |

## 2.3 需要大量上下文才能读懂的代码

| 模块 | 为什么难读 |
|---|---|
| `ai.ts`（1183 行） | 9 类职责、8 个巨型 prompt 内嵌、约 600 行是提示词 |
| `zhenti/[id]/page.tsx`（782 行） | 拉取 + 收藏 + 作答 + 语音 + 批改 + 对比表 + 导航，UI 与业务混合 |
| `shenlun/[id]/page.tsx`（642 行） | 同上，且与 zhenti 页面 77% 重复 |
| 申论试卷链路 | 跨 7 个文件；"全生成"是前端串行（为绕 60s），并发闸 2 分钟，改题干清空答案——三件事必须一起理解 |
| `Record` 表 | 一张表编码三种来源，靠字符串嗅探；新增来源时无任何编译期约束 |

## 2.4 只写在个人记忆里的"本机事实"

`NODE_OPTIONS` shim 会 SIGKILL tsx、Vercel Hobby 60s 上限、`channel_binding` 导致 P1001、Git 必须走 SSH、阿里云 OCR 单页 4MB——**全部只在 `.workbuddy/memory/`，不在仓库文档中**。换一台机器或换一个人，这些坑要重踩一遍。

---

# 第三部分：修改路线

## P0 — 本周做（风险与成本不对称）

| # | 动作 | 收益 | 工时 |
|---|---|---|---|
| 1 | **cron 三个路由加 `CRON_SECRET` 校验** | 当前任何人 curl 即可触发 8k token AI 调用 + 全表写库，可直接刷爆账单 | 30 分钟 |
| 2 | **6 个 AI 路由补 `maxDuration = 60` + 失败 `refundQuota`** | 现状：扣点 → 超时 504 → 不退点。大作文一次损失 2 点 | 半天 |
| 3 | **轮换历史泄露的密钥**（JWT / DeepSeek / DashScope），删 zip | 历史 .env 已泄露；轮换 JWT 会让所有用户重新登录，需提前公告 | 1 小时 + 沟通 |
| 4 | **`Record` 加 `@@index([userId, createdAt])` + Web 历史页分页** | 第 11 条记录之后 Web 永久不可见（功能缺陷，不只是性能） | 半天 |

## P1 — 迭代内做（结构性，但收益可量化）

| # | 动作 | 预期收益 |
|---|---|---|
| 5 | 抽 `src/lib/questionTypes.ts` 单一真源，删除 6 份副本 | 消除"新增题型静默回落"这一类 bug |
| 6 | 抽 `src/lib/constants.ts`（`SCALE`、单价、各处 8000/5000/30000） | 改价/调参不再 grep 全仓 |
| 7 | `Record` 增 `source` + `sourceId`，废弃字符串前缀约定 | 历史记录不再靠嗅探；小程序可复用 |
| 8 | 删 `/api/custom-answer`、`answerQuestion()`、死列（`coins`/`isRead`/`referenceAnswer`） | 净减约 120 行，减少误读 |
| 9 | 申论/真题抽公共层（`useQuestionList`、`<BookmarkPanel>`、`createEvaluateHandler`） | 预计 **-700~900 行**，两模块改动只需改一处 |
| 10 | `scripts/` 拆成 `tools/`（入库）+ `scripts/local/`（忽略） | 杜绝 2026-11-18 的 Vercel 构建事故复发 |
| 11 | 小程序统一 `request()`，消除 21 处硬编码域名 | 换环境不再改 17 个文件 |

## P2 — 随手做（纯减法，半小时级）

| # | 动作 |
|---|---|
| 12 | `next.config.js` 删 `output: 'standalone'` 与 `swcMinify` |
| 13 | `tsconfig.json` 加 `"target": "ES2022"` |
| 14 | 删 `@neondatabase/serverless`、`@types/uuid`；`@types/*` 归位 devDependencies |
| 15 | `.env.example` 补齐 `DATABASE_URL` + `ALIYUN_*` |
| 16 | 删 `code-review-report.md`（更早更短），保留 `CODE_REVIEW.md` 并标注 `[已修/仍有效]` |
| 17 | 根目录重复的 v1.3 更新日志、`2026申论真题参考答案预览.html`、`dev.db` 清理 |

## 建议的落地顺序

```
本周：1 → 2 → 4 → 3（密钥轮换需协调）
下个迭代：5 → 6 → 7 → 8
之后：10 → 11 → 9（重构收益最大但风险最高，放最后）
随手穿插：12~17
```

**理由**：P0 是"不做会出事"，P1 是"做了少踩坑"，P2 是"顺手清理"。第 9 项（申论/真题抽公共层）虽然收益最大，但涉及两个 700+ 行页面，必须在前面的真源（题型、常量）落地后再做，否则会边抽边漂移。

---

# 第四部分：不建议改的

| 项 | 原因 |
|---|---|
| 拆 `ai.ts` | 1183 行确实难读，但 600 行是 prompt 文本。拆分必须"纯搬运不改字"，并加 snapshot 测试；否则一次措辞改动就会让 109 份已入库答案的风格漂移。**建议单独排期，不混在重构里** |
| 合并申论与真题的**数据表** | 两者字段差异真实存在（材料/多答案 vs 对比/图片），合并会引入 nullable 字段与条件分支，得不偿失。只合并**代码层**，不合并表 |
| `VoiceInput` / `AudioUploader` 重写 | 语音是 2026-05-24 用 26 次提交调出来的，无测试覆盖。动它风险远大于收益 |
| 删除 `prisma/migrations/baseline` | 删了就彻底失去起点。正确做法是补一条 `catchup` 迁移（`prisma migrate diff` 生成），让 `migrate deploy` 可用 |
| 把根目录 `CLAUDE.md` 直接删掉 | 它是当前唯一准确的"项目须知"。应拆成 `docs/ONBOARDING.md` + `docs/CONSTRAINTS.md` 入库，而不是丢弃 |

---

# 附：验证记录

以下结论本次已用命令复核，非推测：

| 结论 | 验证方式 |
|---|---|
| cron 三个路由无鉴权 | `grep -l "requireAuth\|CRON_SECRET" src/app/api/cron/*/route.ts` → 无命中 |
| `/api/custom-answer` 零引用 | `grep -rn "custom-answer" src/ ../daijinli-miniapp/src` → 仅自身 |
| `.env` 进过历史 | `git log --all -- .env` → `9455d40` / `28045aa` / `1602eb9` |
| zip 含 `.env` 与 `dev.db` | `unzip -l daijinli-web.zip` → 301 B / 24576 B |
| 17 个路由缺 `force-dynamic` | `grep -rL "force-dynamic" --include=route.ts src/app/api` → 17 / 47 |
| `Record` 无索引 | `schema.prisma:31-43` 无 `@@index` |
