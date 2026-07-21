# 江苏公考AI智能训练平台

AI智能训练平台，支持随机出题、参考答案生成、AI智能批改、语音答题、每日政务要闻。

## 功能特性

- ✅ AI随机生成江苏特色面试题（8大题型，含自定义题目）
- ✅ AI生成高质量参考答案（口头化风格）
- ✅ AI智能批改评分（六维度+改进版答案）
- ✅ 练习记录留存（支持查看历史答题与改进版答案）
- ✅ 语音答题（阿里云语音识别）
- ✅ 每日政务要闻（自动抓取+AI精选）
- ✅ 套题训练（邀请用户专享）
- ✅ 真题复盘（江苏省考历年真题 + AI三答对比 + 汇总参考答案，205题）
- ✅ 申论真题参考（2018-2025江苏申论 + 给定材料原文 + 多名师答案，97题）
- ✅ 用户系统+历史记录
- ✅ 补给站抽卡集卡（学习点激励 + 16 只像素萌宠图鉴，小程序端）
- ✅ 响应式设计，手机端友好

## 技术栈

- Next.js 14 + React 18 + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL(Neon)
- JWT认证
- DeepSeek API
- 阿里云语音识别

## 部署

### Vercel部署（推荐）

1. Fork本仓库到GitHub
2. 在Vercel导入仓库
3. 配置环境变量：
   - `DATABASE_URL` - Neon数据库连接串
   - `JWT_SECRET` - 随机字符串(32位+)
   - `DEEPSEEK_API_KEY` - DeepSeek API Key
   - `DEEPSEEK_BASE_URL` - `https://api.deepseek.com`
   - `ALIYUN_ACCESS_KEY_ID` - 阿里云AccessKey
   - `ALIYUN_ACCESS_KEY_SECRET` - 阿里云Secret
   - `ALIYUN_APP_KEY` - 阿里云语音AppKey
   - `WECHAT_APPID` - 微信小程序 AppID
   - `WECHAT_SECRET` - 微信小程序 Secret
4. 部署

### 环境变量清单

| 变量名 | 说明 | 必填 |
|--------|------|------|
| DATABASE_URL | 数据库连接串 | ✅ |
| JWT_SECRET | JWT签名密钥 | ✅ |
| DEEPSEEK_API_KEY | DeepSeek API密钥 | ✅ |
| DEEPSEEK_BASE_URL | DeepSeek API地址 | ✅ |
| ALIYUN_ACCESS_KEY_ID | 阿里云AccessKey | ❌ |
| ALIYUN_ACCESS_KEY_SECRET | 阿里云Secret | ❌ |
| ALIYUN_APP_KEY | 阿里云语音AppKey | ❌ |
| WECHAT_APPID | 微信小程序 AppID | ❌ |
| WECHAT_SECRET | 微信小程序 Secret | ❌ |

## 项目结构

```
jiangsu-gongkao-ai/
├── src/
│   ├── app/              # Next.js页面和API路由
│   ├── components/       # React组件
│   ├── lib/              # 工具函数（AI、认证、数据库）
│   └── types/            # TypeScript类型
├── prisma/
│   └── schema.prisma     # 数据库模型
├── scripts/              # 运维脚本
└── README.md
```

## 常用脚本

```bash
# 生成邀请码（写入Neon）
node scripts/generate-invite-codes-neon.js 10 [month|year]

# 萌宠种子数据入库（16 只补给品，幂等）
npm run db:seed

# 测试新闻抓取
node scripts/test-news-fetch.js
```

## 注意事项

- `.env`文件含敏感信息，**不要提交到GitHub**
- 本地开发使用SQLite，生产使用Neon PostgreSQL
- 语音功能需要配置阿里云环境变量
