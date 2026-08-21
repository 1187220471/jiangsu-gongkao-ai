# 小程序功能迁移至 Web 分析文档

> 目标：小程序端功能已完善，需将缺项迁移到 Web 端，保持双端功能总体一致。
> 本文档仅做分析与改动范围说明，不涉及代码实现。
> 生成日期：2026-08-21

---

## 一、双端功能现状总览

| 功能模块 | 小程序端 | Web 端 | 状态 |
|---------|---------|--------|------|
| 面试训练（随机出题/语音答题/AI批改） | ✅ | ✅ | 已一致 |
| 申论训练（真题/给定材料/名师答案/AI批改） | ✅ | ✅ | 已一致 |
| 每日政务要闻 | ✅ | ✅ | 已一致 |
| 真题复盘（205题） | ✅ | ✅ | 已一致 |
| 自定义题目 | ✅ | ✅ | 已一致 |
| 每日任务（目标设定/熊猫进度） | ✅ | ❌ | **待迁移** |
| 首页考试倒计时 | ✅ | ❌ | **待迁移** |
| 补给站抽卡（抽卡机/图鉴/装备） | ✅ | ❌ | **待迁移** |
| 学习点系统 | ✅ | ❌ | **待迁移** |
| 专注（番茄钟 30/60 分钟） | ✅ | ❌ | **待迁移** |
| 分享裂变（微信原生分享） | ✅ | ❌ | 平台差异，见 §5.4 |
| 邀请码额度系统 | ✅ | ✅ | 已一致 |
| 小程序账号绑定 | ✅ | ✅ | 已一致 |

---

## 二、核心优势：后端 API 已就绪，无需重写

**迁移前必须先确认的关键事实：** 小程序复用 Web 部署的 Next.js API（`https://www.mianshidati.xyz`），
因此**补给站与专注的全部后端逻辑已经在 Web 仓库中实现并可用**，前端页面层完全没有引用。

已核实存在的 Web 端后端能力：

### 2.1 补给站后端（`daijinli-web/src/lib/supply.ts` + `src/app/api/supply/*`）

| API 路由 | 方法 | 用途 |
|---------|------|------|
| `/api/supply/balance` | GET | 查学习点余额 |
| `/api/supply/earn` | POST | 获取学习点 |
| `/api/supply/draw` | POST | 抽卡（free/paid/share 三来源） |
| `/api/supply/collection` | GET | 图鉴列表 |
| `/api/supply/collection/equip` | POST | 装备/取消装备 |
| `/api/supply/share` | POST | 生成分享 token |
| `/api/supply/share/claim` | POST | 分享核销 |

核心逻辑（`drawItem`）已支持：免费/付费抽、双主题（pixelPet/nbaStar）、稀有度权重、重复兑换 +2 学习点、分享奖励闭环。

### 2.2 专注后端（`daijinli-web/src/lib/focus.ts` + `src/app/api/focus/*`）

| API 路由 | 方法 | 用途 |
|---------|------|------|
| `/api/focus/start` | POST | 创建专注 session |
| `/api/focus/end` | POST | 结束专注（完成/放弃/作弊判定） |
| `/api/focus/active` | GET | 查询进行中的 session |
| `/api/focus/today` | GET | 今日专注汇总 |

核心逻辑已含：30/60 分钟校验、防作弊（服务端时长校验 +5s 容差）、完成发学习点（focus30 +2 / focus60 +4）。

### 2.3 学习点系统（`daijinli-web/src/lib/supply.ts`）

`earnPoints` / `spendPoints` / `getBalance` 均已实现，覆盖全部奖励类型
（answer/set/zhenti/shenlun/focus30/focus60/dailySign/share/draw/drawRepeat/achievement）。

---

## 三、待迁移功能明细与改动范围

### 3.1 首页考试倒计时 ⭐ 工作量低（纯前端）

| 项 | 说明 |
|----|------|
| 涉及文件 | 小程序：`src/utils/examCountdown.ts` + `pages/index/index.tsx` |
| 迁移动作 | 新建 Web 端 `src/lib/examCountdown.ts`（剥离 Taro 依赖，localStorage 替代 storage）；在首页 `src/app/page.tsx` 增加倒计时卡片 |
| 关键点 | 默认国考 2026-11-28、江苏省考 2026-12-05；用户自定义后替换默认；按**北京时间自然日**计算；每 60 秒刷新 |
| 后端改动 | **无**（纯本地存储） |
| 风险 | 无 |

### 3.2 学习点体系 ⭐ 工作量低

| 项 | 说明 |
|----|------|
| 现状 | 后端 `earnPoints` 已完整，但 Web 前端页面层引用为 0 |
| 迁移动画 | 个人中心 `profile/page.tsx` 增加「学习点」展示卡片，复用 `/api/supply/balance` |
| 后续触点 | 练习/申论/真题完成后调用 `/api/supply/earn` 埋点（需确认手机端是否已有此调用，若 Web 没有则一并补上） |
| 后端改动 | **无** |

### 3.3 补给站抽卡 ⭐ 工作量中（纯前端，后端 API 全就绪）

| 项 | 说明 |
|----|------|
| 涉及文件 | 小程序：`src/subpkg-supply/pages/draw/index.tsx`（382行）、`collection/index.tsx`（152行）、`collection/detail/index.tsx`（197行） |
| 迁移动画 | 新建 Web 路由 `/supply`（抽卡机）、`/supply/collection`（图鉴）、`/supply/collection/[id]`（详情）；首页 `page.tsx` 增加补给站入口卡片；个人中心增加入口 |
| 关键点 | 抽卡动画、稀有度展示、装备选择器、双主题 Tab 切换（pixelPet/nbaStar） |
| 前端素材 | 小程序引用 `petAssets.ts`（16 萌宠）、`collectionAssets.ts`、`theme.ts`；**需确认图片资源是否可直接走 Web API/静态资源，或需要额外拷贝** |
| 后端改动 | **无** |
| 风险 | 中（动画还原、素材路径） |

### 3.4 专注（番茄钟）⭐ 工作量中（纯前端，后端 API 全就绪）

| 项 | 说明 |
|----|------|
| 涉及文件 | 小程序：`src/subpkg-focus/pages/timer/index.tsx`（395行）、`utils/focus.ts` |
| 迁移动画 | 新建 Web 路由 `/focus`（番茄钟页）；首页增加入口 |
| 关键点 | 30/60 分钟选择、倒计时、后台切出处理（小程序有切后台处理，Web 需用 `visibilitychange` 或纯服务端校验兜底——后端已有防作弊校验，Web 端只要正确调用 start/end 即可） |
| 后端改动 | **无** |
| 风险 | 低（Web 无后台限制，防作弊后端已兜底） |

### 3.5 每日任务 ⭐ 工作量低（纯前端，本地存储）

| 项 | 说明 |
|----|------|
| 涉及文件 | 小程序：`src/utils/dailyTask.ts`（131行）+ 首页熊猫进度展示 |
| 迁移动画 | 新建 Web 端 `src/lib/dailyTask.ts`（剥离 Taro 依赖）；首页增加每日目标/进度展示 |
| 关键点 | 目标 1-20 可自定义、panda 按完成比例切换三阶段（reading/writing/thumbsup）、按自然日重置 |
| 后端改动 | **无** |
| 风险 | 低 |
| ⚠️ 注意 | 小程序是**本地存储**实现——Web 端同样用 localStorage 时，双端数据不互通，需要用户自行确认是否接受（见 §5.1） |

---

## 四、各模块后端依赖核实

```
TODO: 启动前需完成的一轮快速核实
```

| 模块 | 需核实事项 | 如何核实 |
|------|-----------|---------|
| 学习点/补给站 | Web 端 practice/shenlun/zhenti 答题完成处是否已调用 earnPoints | grep 各页面 fetch 的 `/api/supply/earn` |
| 补给站素材 | 萌宠/NBA 图是否在 Web 可访问路径 | 确认图片存放位置（如 `/public/supply/`） |
| 专注 | `/api/focus/active` 切页后恢复逻辑 | 看小程序 timer 的恢复实现，Web 端照着做 |
| 每日任务 | Web 端若接每日任务计数，需要定义"什么算一次练习"计入 count | 与小程序保持一致：面试答题、申论答题完成触发 |

---

## 五、关键技术决策点（需用户确认）

### 5.1 双端数据互通策略

| 方案 | 说明 | 优点 | 缺点 |
|------|------|------|------|
| A. 本地存储（简单，推荐优先） | 倒计时、每日任务用 localStorage/后端无状态 | 实现最快、无副作用 | 双端各记各的，不互通 |
| B. 服务端同步 | 每日任务/倒计时存入数据库 | 双端互通 | 需新增表/字段和 API，工作量大 |

> 学习点、图鉴、装备、专注记录**天然走服务端**（后端已实现），天然互通，无需讨论。
> 仅「每日任务计数」「自定义考试日期」有本地/服务端的选择问题。

### 5.2 日常任务与学习点联动

小程序端每日任务目前是纯本地计数展示（熊猫进度），**不直接发学习点**（`dailySign` 奖励类型已在后端定义但需确认是否已接线）。
Web 端可保持同样定位，或顺势接入 dailySign 奖励——**需用户拍板**。

### 5.3 首页布局

小程序首页 = 倒计时 + 每日任务 + 补给站入口 + 三大模块。
Web 首页目前 = 三大模块卡片 + 额度提示。
迁移后建议补齐：倒计时卡片 + 每日任务卡片 + 补给站/专注入口卡片，布局需重新设计。

### 5.4 分享裂变的平台差异

| 项 | 小程序 | Web |
|----|--------|-----|
| 做法 | 微信原生分享（Button openType='share' + token 路径） | 浏览器无原生分享，只能复制链接 |
| 建议 | Web 端可做「复制分享链接」，token 机制后端已就绪（/api/supply/share + claim） | 需新增复制到剪贴板 UI |
| 结论 | 不强求在 Web 端还原微信分享，建议用「复制链接」替代，或暂缓 | 优先级低 |

---

## 六、实施顺序建议（供参考）

| 阶段 | 模块 | 预估难度 | 说明 |
|------|------|---------|------|
| 1 | 首页考试倒计时 | 低 | 纯前端，最快见效 |
| 2 | 学习点展示 + 埋点 | 低 | 个人中心卡片 + 各答题页 earn 调用 |
| 3 | 每日任务 | 低 | 纯前端 |
| 4 | 补给站抽卡 | 中 | 页面新建 + 素材 |
| 5 | 专注/番茄钟 | 中 | 页面新建 |
| 6 | 分享裂变（复制链接） | 低-中 | 可选，优先级低 |

---

## 七、改动文件清单（预估）

### 新建文件

| 文件 | 用途 |
|------|------|
| `daijinli-web/src/lib/examCountdown.ts` | 倒计时逻辑（剥离 Taro） |
| `daijinli-web/src/lib/dailyTask.ts` | 每日任务逻辑（剥离 Taro） |
| `daijinli-web/src/app/supply/page.tsx` | 抽卡机页面 |
| `daijinli-web/src/app/supply/collection/page.tsx` | 图鉴页 |
| `daijinli-web/src/app/supply/collection/[id]/page.tsx` | 图鉴详情页 |
| `daijinli-web/src/app/focus/page.tsx` | 番茄钟页面 |
| （可选）`daijinli-web/src/components/ExamCountdown.tsx` | 倒计时组件 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `daijinli-web/src/app/page.tsx` | 首页加倒计时卡片、每日任务卡片、补给站/专注入口 |
| `daijinli-web/src/app/profile/page.tsx` | 加学习点展示卡片 + 补给站入口 |
| （可选）`practice/shenlun/zhenti` 各答题页 | 调 earn 埋点 |

---

## 八、风险与注意点

1. **素材路径**：补给站图片资源位置需先确认（`petAssets` 用的是小程序本地路径如 `/assets/images/...`，Web 端需要新引入）。
2. **防作弊一致性**：专注已完成服务端校验，Web 端只需正确调用 API，不要自己写本地伪完成逻辑。
3. **免费抽次数**：免费抽每日 1 次由服务端记录（`/api/supply/balance` 返回 `freeDrawUsedToday`），Web 端直接复用，天然互通。
4. **北京时间**：倒计时/每日任务的"自然日"判定统一按北京时间，Web 端注意时区处理。
5. **学习点埋点幂等**：`earnPoints` 已有 refId 幂等保护，Web 端各页调用时注意传唯一的 refId（如 `web:answer:{recordId}`），避免双端重复发放。
6. **不回归**：Web 端练习/申论/真题页改动只在"加分埋点"处，不影响现有流程。
---

## 九、实施完成记录（2026-08-21）

> 本轮迁移已全部完成并通过构建验证与冒烟测试，更新总览表状态如下。

| 功能模块 | 小程序端 | Web 端 | 状态 |
|---------|---------|--------|------|
| 每日任务（目标设定/熊猫进度） | ✅ | ✅ | **已迁移** |
| 首页考试倒计时 | ✅ | ✅ | **已迁移** |
| 补给站抽卡（抽卡机/图鉴/装备） | ✅ | ✅ | **已迁移** |
| 学习点系统 | ✅ | ✅ | **已迁移** |
| 专注（番茄钟 30/60 分钟） | ✅ | ✅ | **已迁移** |
| 分享裂变 | ✅ | ✅ | **已迁移**（Web 端为复制链接，见下） |

### 9.1 新增/修改文件清单

| 文件 | 说明 |
|------|------|
| `src/lib/examCountdown.ts` | 倒计时工具（剥离 Taro 依赖） |
| `src/lib/dailyTask.ts` | 每日任务工具（本地存储，与小程序一致） |
| `src/lib/supplyApi.ts` | 补给站 API 客户端（balance/collection/draw/share/equip） |
| `src/lib/focusApi.ts` | 专注 API 客户端（start/end/today/active） |
| `src/lib/theme.ts` | 双主题元数据 + 图片 URL 处理 |
| `src/components/SupplyBalanceCard.tsx` | 个人中心学习点卡片（可复用） |
| `src/app/page.tsx` | 首页新增：考试倒计时卡片、每日任务卡片、补给站/专注入口 |
| `src/app/profile/page.tsx` | 个人中心新增学习点卡片 |
| `src/app/supply/page.tsx` | 抽卡机页面（双主题 Tab、滚轮动画、免费/付费/分享抽） |
| `src/app/supply/collection/page.tsx` | 图鉴列表页（双主题 Tab、进度条、展示中标记） |
| `src/app/supply/collection/[id]/page.tsx` | 图鉴详情页（装备/取消、复制分享链接） |
| `src/app/focus/page.tsx` | 专注页（30/60 选择、环形倒计时、暂停/继续、切后台检测） |
| `src/app/globals.css` | 追加抽卡机/专注页像素风动画 |
| `public/collection/` | 拷贝补给站素材（30 张：宠物+NBA+capsule+panda） |

### 9.2 关键实现决策

1. **数据互通**：每日任务计数与自定义考试日期沿用小程序方案（本地存储，双端各记各的），与小程序行为一致，未引入后端存储。
2. **每日任务奖励**：保持与小程序一致的纯本地进度展示，未接学习点奖励（避免双端重复发放与复杂度）。
3. **分享裂变（Web）**：微信原生分享无法在 Web 使用，改为「复制分享链接」按钮，复用同一套服务端 token 机制（`/api/supply/share`），好友打开 `/supply?shareToken=xxx` 获得独立免费抽，核销后分享者 +1 学习点，每日 10 次上限一致。
4. **切后台检测（Web）**：用 `visibilitychange` 模拟小程序的 useDidHide/useDidShow，离开超 5 分钟提示放弃。
5. **路由**：抽卡机与图鉴页通过 `useSearchParams` 读取 `category`/`shareToken`，外层包 Suspense 满足 Next 14 要求。

### 9.3 验证情况

- `next build`：34/34 页面生成成功，类型检查通过（无新增类型错误）。
- 冒烟测试（dev server 全量 200）：`/`、`/supply`、`/supply/collection`、`/supply/collection/1`、`/focus`、`/profile`。
- 关键内容渲染验证：首页含「考试倒计时/每日任务/补给站/专注/学习点」；`/supply` 含「免费抽一次」；`/focus` 含「选择专注时长」。

### 9.4 已知提醒

- 构建环境提示 `api/profile`、`api/voice/aliyun-token` 为 DYNAMIC_SERVER_USAGE 警告（既有问题，非本次迁移引入），如后续出现运行时问题可为其补充 `export const dynamic = 'force-dynamic'`。
- 每日任务/倒计时数据为本地存储，清浏览器缓存或换设备会重置（与小程序端行为一致）。
