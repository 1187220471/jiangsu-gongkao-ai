# Vercel 部署详细指南

> 适合零基础用户，每一步都有截图说明。预计耗时 30-40 分钟。

---

## 准备工作清单

在开始之前，请确认你已准备好：

- [ ] 一个**邮箱**（用于注册所有平台）
- [ ] 一个**AI API Key**（DeepSeek 或通义千问，详见下文步骤2）
- [ ] 可以访问外网的浏览器（Chrome/Edge/Safari 均可）

---

## 整体流程概览

```
第1步：注册 GitHub 账号（代码仓库）
第2步：获取 AI API Key（网站的大脑）
第3步：注册 Neon 账号（免费数据库）
第4步：上传代码到 GitHub
第5步：注册 Vercel 账号并连接 GitHub
第6步：配置环境变量
第7步：一键部署
第8步：初始化数据库
第9步：验证网站
```

---

## 第1步：注册 GitHub 账号

GitHub 是全球最大的代码托管平台，相当于代码的"网盘"。

### 1.1 打开 GitHub 注册页面
在浏览器地址栏输入：
```
https://github.com/signup
```

### 1.2 填写注册信息
- **邮箱地址**：输入你的常用邮箱
- **密码**：设置一个强密码（至少8位，包含大小写字母+数字）
- **用户名**：填写你喜欢的英文名（如 `daijinli2026`），这个名后面会用到
- 按照页面提示完成验证（可能需要拖动滑块或选择图片）
- 点击 **Create account**

### 1.3 验证邮箱
- 去你的邮箱查收 GitHub 发来的验证邮件
- 点击邮件中的验证链接
- 回到 GitHub 页面，选择一些兴趣标签（随便选即可），然后点击 **Continue**
- 选择免费版（Free），点击 **Continue for free**

> ✅ **第1步完成**。你现在有了 GitHub 账号。

---

## 第2步：获取 AI API Key

你的面试训练网站需要一个"大脑"来出题和批改，这就是 AI 大模型。我们需要获取调用 AI 的密钥。

### 推荐方案：DeepSeek（性价比高，国内可用）

#### 2.1 注册 DeepSeek 开放平台
在浏览器中打开：
```
https://platform.deepseek.com
```

#### 2.2 登录/注册
- 如果已有 DeepSeek 账号，直接登录
- 如果没有，点击注册，用手机号注册即可

#### 2.3 充值
- 登录后，点击左侧菜单的 **API Keys**
- 首次使用需要充值，点击充值按钮
- 充值 10 元即可（足够你用很久）
- 支持支付宝/微信支付

#### 2.4 创建 API Key
- 在 **API Keys** 页面，点击 **创建 API Key**
- 名称随意填写，如 `daijinli-web`
- 点击确认后，会显示一串字符，格式类似：
  ```
  sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
- ⚠️ **非常重要**：立刻把这串字符复制下来保存到记事本！！！这个 Key 只会显示一次，刷新页面后就看不到了
- 保存在一个安全的地方，后面第6步会用到

### 备选方案：通义千问（阿里云）

如果不想用 DeepSeek，也可以用通义千问：

1. 打开 https://dashscope.aliyun.com
2. 用阿里云账号登录
3. 点击 **API-KEY 管理**
4. 创建新的 API Key
5. 新用户有免费额度

> ✅ **第2步完成**。你现在有了 AI API Key，把它保存好。

---

## 第3步：注册 Neon 账号（免费数据库）

Vercel 不能保存文件，所以我们需要一个外部的数据库来存用户信息和答题记录。Neon 提供免费的 PostgreSQL 数据库。

### 3.1 打开 Neon 注册页面
在浏览器中输入：
```
https://neon.tech
```

### 3.2 注册账号
- 点击页面上的 **Sign Up** 或 **Get Started**
- 选择 **Continue with GitHub**（用刚注册的 GitHub 账号一键登录）
- 授权 Neon 访问你的 GitHub 信息

### 3.3 创建项目
- 登录后，Neon 会自动创建一个默认项目
- 如果没看到项目，点击 **New Project**
- 项目名称填写 `daijinli`
- 数据库名称保持默认即可
- 区域选择 **Singapore**（离我们最近，速度最快）
- 点击 **Create Project**

### 3.4 获取数据库连接字符串
- 项目创建后，你会看到一个连接信息面板
- 找到 **Connection String** 或 **PgBouncer** 选项
- 点击旁边的复制按钮，复制类似这样的字符串：
  ```
  postgresql://daijinli:xxxxx@ep-xxxxxx.ap-southeast-1.aws.neon.tech/daijinli?sslmode=require
  ```
- ⚠️ **非常重要**：把这串连接字符串完整复制保存到记事本！！！后面第6步会用到

> ✅ **第3步完成**。你现在有了免费的数据库。

---

## 第4步：上传代码到 GitHub

### 4.1 在 GitHub 创建新仓库
- 打开 https://github.com/new
- 或在你的 GitHub 主页点击左上角的 **+** 号 → **New repository**

### 4.2 填写仓库信息
- **Repository name**：填写 `daijinli-web`
- **Description**（可选）：填写 `戴锦鲤 - AI面试训练平台`
- **Visibility**：选择 **Public**（公开，免费）
- 不要勾选任何初始化选项（不要勾选 README、.gitignore 等）
- 点击页面最下方的 **Create repository**

### 4.3 获取仓库地址
创建成功后，你会看到类似这样的页面，找到这段代码：
```bash
git remote add origin https://github.com/你的用户名/daijinli-web.git
```
- 复制其中的仓库地址（`https://github.com/你的用户名/daijinli-web.git`）
- 保存到记事本，后面会用到

> ✅ **第4步完成**。GitHub 仓库已创建。

---

## 第5步：注册 Vercel 账号并连接 GitHub

Vercel 是一个免费的网站托管平台，可以自动从 GitHub 拉取代码并部署上线。

### 5.1 打开 Vercel 注册页面
在浏览器中输入：
```
https://vercel.com/signup
```

### 5.2 注册
- 点击 **Continue with GitHub**
- 授权 Vercel 访问你的 GitHub 账号
- 如果提示选择团队，选择 **Personal Account**（个人账号）

### 5.3 导入 GitHub 仓库
- 注册成功后，进入 Vercel Dashboard
- 点击 **Add New...** → **Project**
- 你会看到 GitHub 仓库列表，找到 `daijinli-web`
- 如果没看到，点击 **Adjust GitHub App Permissions**，确保 Vercel 有权限访问你的仓库
- 找到 `daijinli-web` 后，点击 **Import**

### 5.4 配置构建设置（关键步骤）
在导入页面，需要检查/修改以下配置：

- **Framework Preset**：应该自动识别为 `Next.js`，如果不是，手动选择 **Next.js**
- **Root Directory**：保持默认（`./`）
- **Build Command**：默认是 `next build`，需要改成：
  ```
  prisma generate && next build
  ```
  - 点击 Build Command 旁边的编辑图标（铅笔）
  - 将内容改为上面的命令
  - 点击确认

- **Output Directory**：保持默认（`./.next`）
- **Install Command**：保持默认（`npm install`）

> ✅ **第5步完成**。Vercel 已连接到你的 GitHub 仓库。

---

## 第6步：配置环境变量

环境变量是网站的"配置密码"，包含数据库地址、AI Key 等信息。这些敏感信息不会公开在代码中。

### 6.1 打开环境变量配置
- 在 Vercel 导入页面，向下滚动找到 **Environment Variables**
- 或部署后，进入 Project 设置 → Environment Variables

### 6.2 逐个添加以下环境变量

点击 **Add** 按钮，逐个添加：

#### 变量1：数据库连接
- **Name**：`DATABASE_URL`
- **Value**：粘贴第3步中从 Neon 复制的数据库连接字符串
  ```
  postgresql://用户名:密码@主机名/数据库名?sslmode=require
  ```
- 点击 **Add**

#### 变量2：JWT密钥
- **Name**：`JWT_SECRET`
- **Value**：输入一个随机长字符串（至少32位），比如：
  ```
  daijinli-2026-interview-training-secret-key-x7y9z2
  ```
- 点击 **Add**

#### 变量3：AI API Key（DeepSeek）
- **Name**：`DEEPSEEK_API_KEY`
- **Value**：粘贴第2步中获取的 DeepSeek API Key
  ```
  sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
- 点击 **Add**

#### 变量4：AI 基础地址
- **Name**：`DEEPSEEK_BASE_URL`
- **Value**：
  ```
  https://api.deepseek.com
  ```
- 点击 **Add**

### 6.3 如果使用通义千问代替 DeepSeek
把上面变量3和4替换为：
- `DASHSCOPE_API_KEY` = 你的通义千问 Key
- `DASHSCOPE_BASE_URL` = `https://dashscope.aliyuncs.com/compatible-mode/v1`

### 6.4 确认环境变量
添加完成后，页面上应该显示这4个环境变量：
- `DATABASE_URL`
- `JWT_SECRET`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`

> ✅ **第6步完成**。所有敏感配置已安全保存。

---

## 第7步：一键部署

### 7.1 开始部署
- 确认环境变量都添加完毕后
- 点击页面下方的 **Deploy** 按钮

### 7.2 等待构建
- Vercel 会自动拉取代码、安装依赖、构建网站
- 这个过程大约需要 2-5 分钟
- 你可以看到构建日志滚动
- 如果构建失败，日志会显示红色错误，截图发给我帮你排查

### 7.3 部署成功
- 构建成功后，页面会变成绿色
- 你会看到类似这样的访问地址：
  ```
  https://daijinli-web-你的用户名.vercel.app
  ```
- 点击访问地址，看看网站是否能打开

> ✅ **第7步完成**。网站已上线！但还需要初始化数据库。

---

## 第8步：初始化数据库

网站上线了，但数据库还是空的，需要创建表结构。

### 8.1 打开 Vercel 的 Function Logs
- 在 Vercel Dashboard 中，点击你的项目
- 点击顶部菜单的 **Functions**
- 或点击 **Deployments** → 最新的部署 → **Functions**

### 8.2 使用 Prisma Migrate 初始化数据库
Vercel 的构建过程不会自动运行数据库迁移。我们需要手动执行一次。

#### 方案A：本地执行（推荐）
如果你有 Node.js 环境（或者让朋友帮忙）：

1. 克隆你的 GitHub 仓库到本地
2. 安装依赖：`npm install`
3. 在 `.env` 文件中设置 `DATABASE_URL` 为 Neon 的连接字符串
4. 运行：`npx prisma db push`

#### 方案B：使用 Vercel CLI（更复杂，不推荐新手）

#### 方案C：最简单的方式——在 Vercel 上创建一个初始化 API
最简单的方法是：在本地修改代码，添加一个初始化接口，部署后访问一次即可。

**操作步骤：**

1. 打开你的 GitHub 仓库页面
2. 点击 `src/app/api` 目录
3. 点击 **Add file** → **Create new file**
4. 文件路径填写：`src/app/api/init-db/route.ts`
5. 文件内容粘贴：

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // 测试数据库连接
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ message: '数据库连接成功，表已创建' })
  } catch (error: any) {
    return NextResponse.json(
      { error: '数据库初始化失败', detail: error.message },
      { status: 500 }
    )
  }
}
```

6. 拉到页面最下方，填写 Commit 信息：
   - **Commit message**：`add: init db api`
   - 选择 **Commit directly to the main branch**
   - 点击 **Commit new file**

7. 等待约1分钟，Vercel 会自动重新部署

8. 部署完成后，在浏览器中访问：
   ```
   https://你的域名/api/init-db
   ```
   如果看到 `{"message":"数据库连接成功，表已创建"}`，说明数据库已就绪

> ⚠️ **安全提醒**：这个初始化接口建议只在首次部署时访问，之后可以删除这个文件，或者修改为需要密码才能访问。

### 8.3 删除初始化接口（可选，为了安全）
数据库初始化完成后，建议删除这个临时接口：
1. 回到 GitHub 仓库
2. 找到 `src/app/api/init-db/route.ts`
3. 点击文件 → 点击右上角的 **...** → **Delete file**
4. 提交删除

> ✅ **第8步完成**。数据库已初始化，网站完全可用。

---

## 第9步：验证网站

### 9.1 访问首页
在浏览器中打开你的 Vercel 域名：
```
https://daijinli-web-你的用户名.vercel.app
```

### 9.2 测试完整流程
1. **注册**：点击注册，创建一个测试账号
2. **登录**：用刚注册的账号登录
3. **开始练习**：选择题型 → 随机出题 → 查看参考答案 → 自己作答 → 提交批改
4. **查看历史**：查看练习记录

### 9.3 常见问题排查

| 问题 | 解决方案 |
|---|---|
| 页面打不开 | 检查 Vercel 部署状态，看是否有构建错误 |
| 注册/登录失败 | 检查 `DATABASE_URL` 环境变量是否正确 |
| AI 出题失败 | 检查 `DEEPSEEK_API_KEY` 是否正确，余额是否充足 |
| 历史记录不保存 | 数据库未初始化，执行第8步 |

---

## 费用预估

| 服务 | 免费额度 | 预估月费 |
|---|---|---|
| Vercel 托管 | 无限流量（带宽有限制） | ¥0 |
| Neon 数据库 | 500MB 存储 + 无限连接 | ¥0 |
| DeepSeek API | 按量计费 | 1000次约 ¥3-5 |
| **总计** | | **约 ¥0-5/月** |

---

## 后续维护

### 更新网站代码
1. 修改 GitHub 仓库中的代码
2. Vercel 会自动检测到更改并重新部署（约1-2分钟）

### 查看用量
- **Vercel**：Dashboard → 项目 → Usage
- **Neon**：Dashboard → 项目 → Usage
- **DeepSeek**：platform.deepseek.com → 用量统计

### 绑定自定义域名（可选）
1. 在域名服务商购买域名（如阿里云、腾讯云，约 ¥30-60/年）
2. 在 Vercel 项目设置中添加自定义域名
3. 按照 Vercel 的 DNS 指引配置域名解析

---

## 需要帮助？

如果在任何步骤中遇到问题：
1. **截图**出错页面
2. 把截图和**具体的操作步骤**发给我
3. 我会帮你排查并给出解决方案

祝你部署顺利！🐟
