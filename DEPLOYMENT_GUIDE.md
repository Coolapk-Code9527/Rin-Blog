# Rin-Blog 部署指南

本指南提供如何修复构建问题并成功将Rin-Blog部署到Cloudflare Pages的步骤。

## 前置需求

- Node.js >= 18
- Bun >= 1.0
- Git

## 修复构建问题

如果你遇到了与依赖相关的构建错误，按照以下步骤解决：

### 1. 克隆仓库

```bash
git clone https://github.com/Coolapk-Code9527/Rin-Blog.git
cd Rin-Blog
```

### 2. 安装依赖

```bash
bun install
```

如果遇到 lockfile 冻结错误：
```
error: lockfile had changes, but lockfile is frozen
```

请确保不使用 `--frozen-lockfile` 标志：
```bash
bun install
```

然后提交更新后的 lockfile：
```bash
git add bun.lockb
git commit -m "更新 lockfile 以匹配新的依赖"
```

### 3. 修复react-markdown导入问题

如果遇到以下错误：

```
[commonjs--resolver] Package subpath 'undefined' is not defined by "exports" in /opt/buildhome/repo/node_modules/react-markdown/package.json.
```

有两种修复方式：

#### 方式一：运行提供的修复脚本

```bash
chmod +x fix-dependencies.sh
./fix-dependencies.sh
```

#### 方式二：手动修复

1. 修改导入语句

打开并编辑以下文件：
- `client/src/page/feed.tsx`
- `client/src/components/markdown.tsx`

将以下导入方式：
```typescript
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
```

替换为：
```typescript
import ReactMarkdown from 'react-markdown';
```

2. 更新依赖

```bash
bun add react-markdown@latest remark-gfm rehype-raw rehype-katex rehype-slug rehype-autolink-headings remark-math
```

3. 清理缓存

```bash
rm -rf node_modules/.vite
```

## 部署到Cloudflare Pages

### 1. 本地构建测试

确保项目能在本地成功构建：

```bash
bun run build
```

### 2. 配置Cloudflare Pages

1. 登录Cloudflare控制台
2. 选择"Pages"
3. 创建新应用程序
4. 连接GitHub仓库
5. 配置构建设置：

   - 框架预设：None
   - 构建命令：`asdf install bun latest && asdf global bun latest && bun i && bun b`
   - 输出目录：`client/dist`
   - 环境变量：
     - `NODE_VERSION`: `18`

   如果遇到 lockfile 错误，可以修改构建命令：
   ```bash
   asdf install bun latest && asdf global bun latest && bun i --no-frozen-lockfile && bun b
   ```

### 3. 高级设置（可选）

如果需要自定义构建过程，可以在项目根目录创建一个`_worker.js`文件，以处理特定路由或实现自定义逻辑。

### 4. 部署

提交并推送变更到GitHub仓库，Cloudflare Pages将自动部署你的应用。

### 5. 自定义域名（可选）

1. 在Cloudflare Pages控制台中，选择你的项目
2. 点击"自定义域"
3. 添加自定义域名并按照提示进行DNS配置

## 故障排查

如果构建仍然失败，请检查以下几点：

1. 确保所有依赖版本兼容
2. 检查构建日志中的详细错误信息
3. 尝试使用`bun run build --debug`获取更多调试信息
4. 在本地环境中确认构建可以成功，然后再推送到GitHub
5. 如果遇到 lockfile 相关错误，可以尝试：
   - 删除 `bun.lockb` 文件并重新生成：`rm bun.lockb && bun install`
   - 在 CI/CD 环境中添加 `--no-frozen-lockfile` 标志

如有进一步问题，请参考[官方文档](https://developers.cloudflare.com/pages/)或在GitHub仓库中提交Issue。 