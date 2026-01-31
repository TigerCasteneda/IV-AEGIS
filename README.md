# IV-AEGIS - AI Security Shield Website

AEShield 官方网站 - 使用对抗样本技术保护图像免受 AI 滥用。

## 🌐 在线访问

- **前端**: [待部署]
- **后端 API**: [待部署]

## 📁 项目结构

```
IV-AEGIS/
├── frontend/          # 前端静态网站
│   ├── index.html    # 主页面
│   └── *.jpg         # 图片资源
├── backend/          # 后端 API 服务器
│   ├── server.js     # Express 服务器
│   ├── database.js   # SQLite 数据库配置
│   ├── routes/       # API 路由
│   └── db/           # 数据库文件（不提交到 Git）
└── package.json      # 项目配置
```

## 🚀 本地开发

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 创建数据库目录

```bash
mkdir backend/db
```

### 3. 启动后端服务器

```bash
cd backend
npm start
```

服务器将在 `http://localhost:3001` 启动

### 4. 访问网站

在浏览器打开: `http://localhost:3001`

## 🌍 部署到生产环境

### 方案 1: Railway (后端) + Vercel (前端)

#### 后端部署到 Railway:

1. 访问 [Railway.app](https://railway.app/)
2. 使用 GitHub 账号登录
3. 点击 "New Project" → "Deploy from GitHub repo"
4. 选择 `TigerCasteneda/IV-AEGIS` 仓库
5. Railway 会自动检测 Node.js 项目并部署
6. 部署成功后，复制后端 URL（例如：`https://your-app.railway.app`）

#### 前端部署到 Vercel:

1. 访问 [Vercel.com](https://vercel.com/)
2. 使用 GitHub 账号登录
3. 点击 "Add New" → "Project"
4. 选择 `TigerCasteneda/IV-AEGIS` 仓库
5. 配置构建设置：
   - **Framework Preset**: Other
   - **Root Directory**: `frontend`
   - **Build Command**: 留空
   - **Output Directory**: `.`
6. 添加环境变量：
   - `VITE_API_URL` = 你的 Railway 后端 URL
7. 点击 "Deploy"

#### 更新前端 API 地址:

部署后需要更新前端代码中的 API 地址。在 `frontend/index.html` 中找到：

```javascript
const response = await fetch('http://localhost:3001/api/contact/submit', {
```

改为：

```javascript
const API_URL = 'https://your-backend.railway.app'; // 替换为你的 Railway URL
const response = await fetch(`${API_URL}/api/contact/submit`, {
```

### 方案 2: Render (全栈部署)

Render 可以免费部署后端 + 静态前端：

1. 访问 [Render.com](https://render.com/)
2. 创建 Web Service 用于后端
3. 创建 Static Site 用于前端

### 方案 3: Netlify + Heroku

类似的组合方案。

## 📊 数据库管理

使用 [DB Browser for SQLite](https://sqlitebrowser.org/) 查看联系表单数据：

1. 下载并安装 DB Browser for SQLite
2. 打开 `backend/db/contacts.db`
3. 点击 "Browse Data" 查看 `contacts` 表

## 🔒 安全特性

- ✅ DDOS 防护（请求频率限制）
- ✅ CORS 跨域保护
- ✅ 请求体大小限制
- ✅ 请求超时设置
- ✅ SQL 注入防护（参数化查询）
- ✅ XSS 防护

## 📧 API 端点

- `POST /api/contact/submit` - 提交联系表单
- `GET /api/contact/list` - 获取所有联系信息（需要认证）
- `PUT /api/contact/:id/status` - 更新联系状态
- `GET /health` - 健康检查

## 🛠️ 技术栈

**前端:**
- HTML5
- CSS3 (原生)
- JavaScript (原生)
- Font Awesome 图标

**后端:**
- Node.js
- Express.js
- SQLite3
- express-rate-limit (速率限制)
- CORS (跨域资源共享)

## 📝 环境变量

创建 `.env` 文件（生产环境）：

```env
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.vercel.app
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 👥 团队

- Nathan Liao - CEO
- Tiger Liu - CTO
- Dora Zhu - CFO
- Kaitlyn Xu - CMO

---

© 2025 AEShield. All rights reserved.
