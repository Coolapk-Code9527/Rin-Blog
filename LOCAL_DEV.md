# Rin-Blog 本地开发指南

本指南将帮助你在本地设置开发环境，实现前端和后端在本地运行，同时连接到远程 Cloudflare 的 D1 数据库和 R2 存储桶。

## 背景

Rin-Blog 项目使用 Cloudflare Pages 进行部署，数据存储在 Cloudflare D1（数据库）和 R2（对象存储）中。在本地开发时，我们希望：

1. 前端本地运行（http://localhost:5173）
2. 后端本地运行（http://localhost:11498）
3. 同时能够访问远程的 Cloudflare D1 数据库和 R2 存储桶中的数据

## 安装依赖

首先确保安装了以下依赖：

1. [Bun](https://bun.sh/) - 项目使用 Bun 作为包管理器和运行时
2. [Wrangler](https://developers.cloudflare.com/workers/wrangler/) - Cloudflare Workers 的命令行工具
3. 添加并安装 concurrently 包（用于同时运行多个命令）:
   ```bash
   bun add -D concurrently
   ```

## 配置修改

### 1. 修改服务器配置

在 `server/package.json` 中添加 `dev:remote` 脚本，以启用远程模式：

```json
"scripts": {
  "dev": "bun wrangler dev --port 11498",
  "dev:remote": "bun wrangler dev --port 11498 --remote",
  ...
}
```

`--remote` 标志让 Wrangler 使用远程的 Cloudflare 服务，而不是在本地模拟。

### 2. 修改客户端 API 端点配置

在 `client/src/main.tsx` 中确保 API 端点指向本地服务器：

```typescript
// 确保API端点始终指向本地服务器
export const endpoint = 'http://localhost:11498'
export const oauth_url = endpoint + '/user/github'
```

### 3. 配置根项目的启动脚本

在根目录的 `package.json` 中添加启动脚本：

```json
"scripts": {
  "dev": "concurrently \"bun run dev:server\" \"bun run dev:client\"",
  "dev:client": "cd client && bunx --bun vite",
  "dev:server": "cd server && bun run dev:remote",
  ...
}
```

### 4. 环境变量配置

确保你的 `.dev.vars` 文件包含以下环境变量：

```
RIN_GITHUB_CLIENT_ID=你的GitHub客户端ID
RIN_GITHUB_CLIENT_SECRET=你的GitHub客户端密钥
JWT_SECRET=你的JWT密钥
S3_ACCESS_KEY_ID=你的Cloudflare R2访问密钥ID
S3_SECRET_ACCESS_KEY=你的Cloudflare R2秘密访问密钥
```

### 5. 确保 wrangler.toml 文件正确配置

检查你的 `wrangler.toml` 文件是否包含正确的 D1 数据库和 R2 存储桶配置。根据你使用的 Wrangler 版本，配置可能有所不同：

对于 Wrangler 3.x 版本（当前项目使用）：
```toml
name = "rin-server"
main = "server/src/_worker.ts"
compatibility_date = "2024-05-29"
# Wrangler 3.x 使用 node_compat
node_compat = true

[triggers]
crons = ["*/20 * * * *"]

[vars]
FRONTEND_URL = "http://localhost:5173"
S3_FOLDER = "images/"
S3_CACHE_FOLDER = "cache/"
S3_REGION = "auto"
S3_ENDPOINT = "你的R2端点"
S3_ACCESS_HOST = "你的R2访问主机"
S3_BUCKET = "你的存储桶名称"
S3_FORCE_PATH_STYLE = "false"

[[d1_databases]]
binding = "DB"
database_name = "rin"
database_id = "你的数据库ID"
```

对于 Wrangler 4.x 版本：
```toml
name = "rin-server"
main = "server/src/_worker.ts"
compatibility_date = "2024-05-29"
# Wrangler 4.x 使用 nodejs_compat
nodejs_compat = true

# 其余配置与上相同
```

### 6. Node.js 兼容性问题修复

为了与 Cloudflare Workers 的 Node.js 兼容性正常工作，需要修改以下导入：

- 在所有使用 Node.js 内置模块的文件中，将导入从：
  ```typescript
  import path from "path";
  ```
  改为：
  ```typescript
  import path from "node:path";
  ```

主要需要修改的文件包括：
- `server/src/services/favicon.ts`
- `server/src/services/rss.ts`
- `server/src/utils/cache.ts`

## 启动开发环境

运行以下命令启动完整的开发环境：

```bash
bun run dev
```

这将同时启动：
- 前端服务器（http://localhost:5173）
- 后端服务器（http://localhost:11498），连接到远程 Cloudflare D1 和 R2

## 常见问题与解决方案

### 1. Wrangler 版本问题

如果遇到 `node_compat` 不再被支持的错误：

```
The "node_compat" field is no longer supported as of Wrangler v4. 
Instead, use the `nodejs_compat` compatibility flag.
```

解决方案：
- 如果使用 Wrangler 4.x：修改 `wrangler.toml` 文件，将 `node_compat` 改为 `nodejs_compat`
- 如果使用 Wrangler 3.x：保持使用 `node_compat`

### 2. Node.js 模块导入错误

如果遇到类似以下错误：

```
Could not resolve "path"
The package "path" wasn't found on the file system but is built into node.
```

解决方案：
1. 确保 `wrangler.toml` 中配置了 `node_compat = true`（Wrangler 3.x）或 `nodejs_compat = true`（Wrangler 4.x）
2. 将所有 Node.js 内置模块的导入使用 `node:` 前缀，例如 `import path from "node:path"`

### 3. 连接权限问题

如果无法连接到 Cloudflare 服务，可能是权限问题：

1. 确保已登录到 Cloudflare 账户：
   ```bash
   npx wrangler login
   ```
   
2. 检查 API 令牌权限，确保包含以下权限：
   - Account D1
   - Account R2 Storage
   - Account Workers Scripts

### 4. D1 数据库连接问题

可以通过以下命令测试 D1 数据库连接：

```bash
bun run d1 list
```

如果有问题，确认：
1. `.dev.vars` 文件中的配置是否正确
2. `wrangler.toml` 中的数据库 ID 是否正确

### 5. R2 存储桶连接问题

可以通过以下命令测试 R2 存储桶连接：

```bash
bun run r2 list
```

如果有问题，确认：
1. `.dev.vars` 文件中的 S3 相关配置是否正确
2. `wrangler.toml` 中的 S3 相关变量是否正确设置

### 6. CORS 问题

如果遇到跨域请求被拒绝的问题，检查服务端 CORS 配置。在 `server/src/server.ts` 中，确保 CORS 配置允许本地前端域名：

```javascript
.use(cors({
    aot: false,
    origin: ['http://localhost:5173', '你的其他域名'],
    methods: '*',
    // ... 其他配置
}))
```

## 本地开发最佳实践

1. 本地修改数据时，记住这些修改会直接影响到生产环境的数据库
2. 开发功能时，考虑创建测试数据，并在测试完成后清理
3. 对于敏感操作，考虑在本地添加额外的确认步骤，防止意外修改生产数据

## 验证配置成功

若配置成功，你应该能够：
1. 在前端（http://localhost:5173）看到之前部署在 Cloudflare Pages 上的博客文章
2. 能够上传图片到 R2 存储桶
3. 能够创建、编辑和删除文章（需要管理员权限）

如有任何问题，欢迎在项目 Issues 中提出。 