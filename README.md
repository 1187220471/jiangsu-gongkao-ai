# 江苏公务员面试训练平台

江苏省公务员面试AI智能训练平台，支持随机出题、参考答案生成、AI智能批改。

## 功能特性

- ✅ AI随机生成江苏特色面试题（6大题型）
- ✅ AI生成高质量参考答案
- ✅ 用户提交答案后AI智能批改评分
- ✅ 用户注册/登录系统
- ✅ 练习历史记录查看
- ✅ 响应式设计，手机端友好

## 部署方案

### 方案一：Docker部署（推荐，最简单）

**前置条件：**
1. 一台云服务器（阿里云/腾讯云/华为云，推荐2核2G以上，月费约50-100元）
2. 已安装Docker和Docker Compose（可让服务器厂商预装）
3. AI API Key（DeepSeek或通义千问）

**步骤：**

1. 将本项目代码上传到服务器（可通过FTP或git）

2. 在项目目录下创建 `.env` 文件：
```bash
cp .env.example .env
```

3. 编辑 `.env` 文件，填入你的AI API Key：
```env
# 数据库（无需修改）
DATABASE_URL="file:./dev.db"

# JWT密钥（换成随机字符串）
JWT_SECRET="your-random-secret-key-at-least-32-characters"

# AI配置（二选一）
# DeepSeek
DEEPSEEK_API_KEY="sk-your-deepseek-api-key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"

# 或通义千问
# DASHSCOPE_API_KEY="sk-your-dashscope-api-key"
# DASHSCOPE_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
```

4. 启动服务：
```bash
docker-compose up -d
```

5. 访问 `http://你的服务器IP:3000`

### 方案二：Vercel部署（免费，但国内访问慢）

**前置条件：**
1. GitHub账号
2. Vercel账号（可用GitHub登录）
3. AI API Key

**步骤：**

1. 在GitHub上创建新仓库，上传代码

2. 登录 [Vercel](https://vercel.com)，导入GitHub仓库

3. 在Vercel的 Environment Variables 中添加：
   - `DATABASE_URL` = `file:./dev.db`
   - `JWT_SECRET` = 随机字符串
   - `DEEPSEEK_API_KEY` = 你的API Key

4. 点击 Deploy，等待部署完成

5. Vercel会分配一个域名，国内访问可能需要加速

## AI API Key 获取

### DeepSeek（推荐，性价比高）
1. 访问 https://platform.deepseek.com
2. 注册账号
3. 充值（少量即可，1000次调用约几块钱）
4. 创建API Key

### 通义千问
1. 访问 https://dashscope.aliyun.com
2. 用阿里云账号登录
3. 创建API Key
4. 新用户有免费额度

## 技术栈

- Next.js 14 + React 18 + TypeScript
- Tailwind CSS
- Prisma + SQLite
- JWT认证
- DeepSeek/通义千问 API

## 项目结构

```
daijinli-web/
├── src/
│   ├── app/              # Next.js页面和API路由
│   ├── lib/              # 工具函数（AI调用、认证、数据库）
│   └── types/            # TypeScript类型定义
├── prisma/
│   └── schema.prisma     # 数据库模型
├── docker-compose.yml    # Docker部署配置
└── README.md             # 本文件
```

## 常见问题

**Q: 数据库数据会丢失吗？**
A: 使用Docker部署时，SQLite数据库文件在容器内。如需持久化，可挂载卷到宿主机。

**Q: 可以切换AI模型吗？**
A: 支持DeepSeek和通义千问，在.env中配置对应API Key即可。

**Q: 如何更新题库？**
A: 本项目AI随机生成题目，无需维护题库。如需要固定题库，可扩展数据库和API。

**Q: 1000次/月够吗？**
A: 每次练习最多调用3次AI（出题+答案+批改），1000次约支持300次完整练习，一般够用。
