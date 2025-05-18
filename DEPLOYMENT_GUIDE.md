# Rin-Blog 部署指南

本指南详细说明了如何解决 Rin-Blog 项目的构建问题，以及如何将项目部署到 Cloudflare Pages。

## 环境准备

确保您已经安装以下工具：

1. Node.js (推荐版本 18+)
2. Bun (最新版本)
3. Git

## 安装和配置 Bun

如果尚未安装 Bun，请按照以下步骤进行安装：

### Linux/macOS

```bash
curl -fsSL https://bun.sh/install | bash
```

### Windows

通过 npm 安装：

```bash
npm install -g bun
```

或者使用 PowerShell：

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

## 解决构建问题

构建失败的主要原因有以下几点：

1. 依赖导入路径问题（例如 react-markdown）
2. 缺少必要的依赖
3. 锁文件冻结错误

### 执行修复脚本

#### 在 Linux/macOS 上：

```bash
chmod +x fix-dependencies.sh
./fix-dependencies.sh
```

#### 在 Windows 上：

```powershell
.\fix-dependencies.ps1
```

### 手动修复步骤

如果脚本执行失败，请按照以下步骤手动修复：

1. 安装最新版本的 react-markdown 及相关依赖：

```bash
bun add react-markdown@latest remark-gfm rehype-raw rehype-katex rehype-slug rehype-autolink-headings remark-math --no-frozen-lockfile
```

2. 安装客户端所需的依赖：

```bash
cd client
bun add react-router-dom react-redux redux web-vitals --no-frozen-lockfile
cd ..
```

3. 清理构建缓存：

**Linux/macOS:**
```bash
rm -rf node_modules/.vite
```

**Windows:**
```powershell
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules/.vite
```

4. 修复错误的导入语句：

将 `client/src/page/feed.tsx` 和 `client/src/components/markdown.tsx` 中的
```typescript
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
```
修改为：
```typescript
import ReactMarkdown from 'react-markdown';
```

5. 尝试重新构建：

```bash
bun run build
```

## 部署到 Cloudflare Pages

### 配置 Cloudflare Pages

1. 登录到 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 "Pages" 部分
3. 点击 "Create a project"（创建项目）

### 连接 GitHub 仓库

1. 选择 "Connect GitHub"（连接 GitHub）
2. 授权 Cloudflare 访问您的 GitHub 账户
3. 从列表中选择 Rin-Blog 仓库
4. 点击 "Begin setup"（开始设置）

### 配置构建设置

配置以下构建设置：

- **Project name**（项目名称）: `rin-blog`（或您喜欢的名称）
- **Production branch**（生产分支）: `main`
- **Framework preset**（框架预设）: `None`
- **Build command**（构建命令）: `bun install --no-frozen-lockfile && bun run build`
- **Build output directory**（构建输出目录）: `dist`
- **Environment variables**（环境变量）: 根据需要添加

### 添加环境变量

根据您的环境需求，添加以下环境变量：

```
DATABASE_NAME=your_database
API_KEY=your_api_key
```

### 部署设置

配置完成后，点击 "Save and Deploy"（保存并部署）按钮。

### 自定义域名（可选）

部署后，您可以为您的 Rin-Blog 添加自定义域名：

1. 在项目页面中，点击 "Custom domains"（自定义域名）
2. 点击 "Set up a custom domain"（设置自定义域名）
3. 输入您的域名并按照指示完成配置

## 后续操作

### 排查部署问题

如果部署过程中遇到问题：

1. 检查构建日志，寻找具体的错误信息
2. 确认环境变量是否正确配置
3. 验证构建命令和输出目录是否正确

### 更新代码

当您更新代码后，只需将更改推送到连接的 GitHub 仓库，Cloudflare Pages 会自动触发新的部署。

### 查看生产环境日志

部署后，您可以在 Cloudflare Pages 界面查看生产环境的日志和性能指标。

## 常见问题解决

### 构建失败

如果构建仍然失败，可能需要检查：

1. `package.json` 文件中的依赖是否完整
2. 是否存在代码语法错误
3. 是否存在导入路径错误

### 运行时错误

如果部署成功但网站运行出现问题：

1. 检查浏览器控制台是否有错误信息
2. 验证 API 端点是否正确配置
3. 检查环境变量是否正确设置

## 结语

通过上述步骤，您应该能够成功解决 Rin-Blog 的构建问题，并将其部署到 Cloudflare Pages。如果您遇到特定问题，请参考 [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/) 或提出 GitHub Issue 寻求帮助。 