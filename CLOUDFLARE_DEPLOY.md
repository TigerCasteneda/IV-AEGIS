# Cloudflare Workers 部署指南

## 📋 前置要求

1. Cloudflare 账号
2. 安装 Wrangler CLI：
   ```bash
   npm install -g wrangler
   ```

## 🚀 部署步骤

### 1. 登录 Cloudflare

```bash
wrangler login
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create iv-aegis-db
```

命令会返回数据库 ID，例如：
```
✅ Successfully created DB 'iv-aegis-db'
database_id = "xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx"
```

**复制这个 database_id，并更新 `wrangler.toml` 文件中的 `database_id`**

### 3. 初始化数据库表

```bash
wrangler d1 execute iv-aegis-db --file=./schema.sql
```

### 4. 本地测试（可选）

```bash
wrangler dev
```

访问 http://localhost:8787 测试

### 5. 部署到生产环境

```bash
wrangler deploy
```

部署成功后，你会得到一个 URL，例如：
```
https://iv-aegis-worker.YOUR_SUBDOMAIN.workers.dev
```

**这就是你的后端 API 地址！**

## 📊 管理数据库

### 查看数据

```bash
wrangler d1 execute iv-aegis-db --command="SELECT * FROM contacts"
```

### 清空数据

```bash
wrangler d1 execute iv-aegis-db --command="DELETE FROM contacts"
```

### 在线管理

访问 Cloudflare Dashboard → Workers & Pages → D1 → 你的数据库 → Console

## 🔗 配置前端

部署完成后，更新前端的 API_URL：

```javascript
const API_URL = 'https://iv-aegis-worker.YOUR_SUBDOMAIN.workers.dev';
```

## 📝 API 端点

- `GET /health` - 健康检查
- `POST /api/contact/submit` - 提交联系表单
- `GET /api/contact/list` - 获取联系列表

## 💰 费用

Cloudflare Workers 免费额度：
- 每天 100,000 次请求
- D1 数据库：每天 5,000,000 次读取，100,000 次写入
- 完全够用！

## 🆘 故障排除

### 错误：database_id 未配置
- 确保在 `wrangler.toml` 中填入了正确的 `database_id`

### 错误：表不存在
- 运行数据库初始化脚本：`wrangler d1 execute iv-aegis-db --file=./schema.sql`

### 查看日志
```bash
wrangler tail
```

## 📚 更多资源

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 数据库文档](https://developers.cloudflare.com/d1/)
