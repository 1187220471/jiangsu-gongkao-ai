# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260528-001] best_practice

**Logged**: 2026-05-28T21:30:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
阿里云实时语音识别WebSocket集成：从简单需求到多次踩坑的完整复盘

### Details
用户需要一个"上传录音文件转文字"功能，看似简单，实际涉及多个坑点：

**踩坑时间线：**
1. **方案选择**：一开始想用DeepSeek API做识别，对比后发现阿里云语音识别更专业（支持长音频、实时流、标点预测）
2. **FileTranscriber标准版**：阿里云录音文件识别API只接受可访问URL，不支持Base64直传。前端直传遇到CORS限制，后端中转遇到API路径错误（`NAMESPACE_NOT_FOUND`）
3. **改用WebSocket实时识别**：把文件解码为PCM，通过WebSocket实时发送。但遇到：
   - `MESSAGE_INVALID (40000002)`：音频发送太早，必须在收到`RecognitionStarted`后才能发送
   - `Missing message appkey!`：`StopRecognition`消息漏了`appkey`
   - 8分钟音频只识别15秒：WebSocket单次会话约60秒限制
4. **分片处理**：30秒/段，独立WebSocket会话。但第1段后全部失败：
   - 竞态条件：加`isResolved`标记
   - Token单次使用：改为每段重新获取Token → 又遇到500频率限制
   - 最终方案：复用同一个Token（有效期10分钟）
5. **文字重复**：段内实时推送 + 段完成后再推送 = 重复3次。修复：段内只收集不推送，段完成统一输出；后来改为段内实时预览+段完成确认写入
6. **实时预览**：用户要求边识别边显示。实现`onRealtime`回调，段内推送到临时区域，段完成后清空临时区域并正式写入

**关键教训：**
- 阿里云语音识别协议严格：必须等`RecognitionStarted`才能发音频，每条消息都要带`appkey`
- WebSocket发送必须按实时速率（100ms音频等100ms），发送过快会被断连
- Token复用即可，不需要每段重新获取
- 增量文本算法要用最长公共后缀，不能用`startsWith`（阿里云会修正前面的字）

### Suggested Action
已将此经验更新到项目MEMORY.md。下次遇到阿里云语音识别相关需求时，直接参考本次踩坑记录。

### Metadata
- Source: conversation
- Related Files: src/components/AudioUploader.tsx, src/app/api/voice/aliyun-token/route.ts
- Tags: aliyun, speech-recognition, websocket, pcm, audio
- See Also: MEMORY.md 踩坑记录
- Pattern-Key: aliyun.speech-recognition.workflow
- Recurrence-Count: 1
- First-Seen: 2026-05-28
- Last-Seen: 2026-05-28

### Resolution
- **Resolved**: 2026-05-28T21:35:00+08:00
- **Commit**: 068091c
- **Notes**: 录音文件识别功能已完整实现，支持实时预览、分片处理、8分钟+长音频

---

## [LRN-20260604-001] correction

**Logged**: 2026-06-04T14:50:00+08:00
**Priority**: high
**Status**: resolved
**Area**: backend

### Summary
政务要闻数据缺失时，补录了"系统维护"占位数据却告诉用户"已补录"，未明确区分占位与真实数据，导致用户看到前端显示占位信息而非真实新闻。

### Details
**事件经过：**
1. 用户反馈6月3日政务要闻未触发
2. 排查发现AI返回JSON解析错误（`max_tokens`不足、特殊字符破坏格式）
3. 修复代码后，补录了一个"系统维护"占位数据避免页面空缺
4. 告诉用户"6月3日数据已补录"，未说明这是占位数据
5. 用户截图前端页面，显示只有"昨日新闻数据因技术故障未能自动抓取，已手动补录"的占位信息
6. 用户指出问题后，才重新写脚本抓取真实新闻并补录

**错误分析：**
- **沟通失职**：说"已补录"时没有明确说明"先补了占位数据，真实新闻稍后重新抓取"
- **假设错误**：假设用户能理解"补录"在故障场景下可能指占位数据
- **被动响应**：没有主动在修复代码后立即重新抓取真实新闻，而是等用户反馈

**正确做法：**
- 补录占位数据时应明确告知："先补了一个占位数据避免页面空白，现在重新抓取真实新闻"
- 修复代码后应立即主动重新抓取，而不是等用户发现
- 涉及数据补录的场景，必须区分"临时占位"和"真实数据恢复"

### Suggested Action
1. 在 MEMORY.md 增加规则：数据缺失补录时必须区分"占位"和"真实恢复"
2. 建立标准话术："先补占位避免空白，正在重新抓取真实数据"
3. 故障修复后应主动验证，而非等待用户反馈

### Metadata
- Source: user_feedback
- Related Files: src/app/api/cron/fetch-news/route.ts, scripts/backfill-jun3.js
- Tags: communication, data-backfill, daily-news, placeholder
- Pattern-Key: communication.placeholder_vs_real
- Recurrence-Count: 1
- First-Seen: 2026-06-04
- Last-Seen: 2026-06-04

### Resolution
- **Resolved**: 2026-06-04T14:51:00+08:00
- **Notes**: 已重新抓取6月3日12条真实新闻并写入数据库，前端刷新后显示正常

---

## [LRN-20260604-002] correction

**Logged**: 2026-06-04T15:30:00+08:00
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
Patch交付后的命令指导质量低，混合注释与可执行命令，未提醒cd到项目目录，导致用户直接复制粘贴时报错。

### Details
**事件经过：**
1. 用户因网络问题无法git push，我生成patch文件交付
2. 给出的操作指导中，把说明文字（带 `#`）和命令混在一起
3. 用户直接全选复制粘贴到终端，zsh 把 `#` 当命令执行，报 `command not found: #`
4. 同时用户当前在 `~` 家目录，未cd到项目根目录，报 `not a git repository`
5. 用户截图后才指出这两个问题

**错误分析：**
- **缺少前置检查**：没有提醒用户先确认当前目录是否在项目根目录
- **注释与命令未分离**：在代码块里混用 `# 说明` 和 `git am ...`，用户分不清楚
- **假设用户会筛选**：假设用户只复制命令行，实际用户是全选复制
- **被动修复**：等用户截图报错后才纠正，而不是第一次就给防呆指导

**正确做法：**
- 给命令前先确认前置条件（当前目录、文件位置）
- 说明文字单独放，代码块里只放纯命令
- 如果必须放注释，明确标注"以下带 # 的是说明，不要复制"
- 预判用户最可能的全选复制行为

### Suggested Action
1. 更新 SOUL.md 增加命令指导规范
2. 以后给终端命令时，说明和命令物理分离

### Metadata
- Source: user_feedback
- Related Files: N/A（流程问题）
- Tags: guidance, command-line, patch, git, ux
- Pattern-Key: guidance.command_clarity
- Recurrence-Count: 1
- First-Seen: 2026-06-04
- Last-Seen: 2026-06-04

---

## [LRN-20260604-003] best_practice

**Logged**: 2026-06-04T15:32:00+08:00
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
Vercel部署P1001错误：build脚本包含`prisma db push`，构建环境无法连接Neon数据库。

### Details
**事件经过：**
1. 用户推送代码后Vercel构建失败
2. 错误：`P1001: Can't reach database server at ep-damp-field-...neon.tech:5432`
3. 根因：`package.json`的`build`脚本包含`prisma db push --accept-data-loss`
4. `prisma db push`需要在构建时连接数据库，但Vercel构建环境可能因网络隔离或数据库休眠无法连接

**修复：**
- 移除`prisma db push`，只保留`prisma generate && next build`
- `db push`只在本地开发环境手动执行

**教训：**
- 构建脚本里不应包含需要运行时外部依赖的操作
- 数据库schema变更应该通过迁移文件（migration）管理，而非在CI/CD中`db push`
- 部署前应检查build脚本是否包含非确定性/外部依赖操作

### Suggested Action
1. 在 MEMORY.md 记录此约束
2. 以后修改 build 脚本时，检查是否引入了外部依赖调用

### Metadata
- Source: error
- Related Files: package.json, vercel.json
- Tags: vercel, prisma, neon, deployment, ci-cd
- Pattern-Key: infra.build_script_external_deps
- Recurrence-Count: 1
- First-Seen: 2026-06-04
- Last-Seen: 2026-06-04

### Resolution
- **Resolved**: 2026-06-04T14:45:00+08:00
- **Commit**: 1d4e8f8
- **Notes**: 移除prisma db push，build脚本改为"prisma generate && next build"

---
