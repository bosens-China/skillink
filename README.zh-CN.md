# Skillink

[English](./README.md) | [简体中文](./README.zh-CN.md)

**Skillink** 是一个 AI 工具配置的符号链接管理工具。
随着 AI 工具逐渐统一到 `AGENTS.md` 和 `.agents/` 标准，部分工具（如 Claude Code）仍维护着自己的生态体系，导致切换 AI 工具时产生割裂感。Skillink 通过符号链接将你的配置同步到各处，弥合这一鸿沟。

> 核心理念：**一次编写，处处生效。**

## 快速开始

```bash
npx @boses/skillink
```

就这么简单。工具会自动执行：

1. 如果不存在 `skillink.config.ts`，自动创建
2. 符号链接 `AGENTS.md` → `CLAUDE.md`
3. 符号链接 `.agents/` → `.claude/`
4. 询问是否将链接目标路径添加到 `.gitignore`

### 跳过确认

```bash
npx @boses/skillink --yes
```

## 配置

首次运行后可编辑 `skillink.config.ts`：

```typescript
export default {
  locale: 'auto', // 'auto' | 'en' | 'zh-CN'
  links: [
    { from: 'AGENTS.md', to: 'CLAUDE.md' },
    { from: '.agents', to: '.claude' },
  ],
};
```

`links` 数组定义源文件/目录到目标的映射。一个源可以映射到多个目标：

```typescript
links: [
  { from: 'AGENTS.md', to: 'CLAUDE.md' },
  { from: 'AGENTS.md', to: '.cursor/rules/AGENTS.md' },
  { from: '.agents', to: '.claude' },
  { from: '.agents', to: '.cursor/rules' },
]
```

### 语言

| 值       | 行为                           |
| :------- | :----------------------------- |
| `auto`   | 自动检测系统语言，中英双语输出 |
| `en`     | 纯英文                         |
| `zh-CN`  | 纯中文                         |

## 工作原理

- **文件映射**：`AGENTS.md` → `CLAUDE.md` 创建单个符号链接
- **目录映射**：`.agents` → `.claude` 创建整个目录的单个符号链接
- **一对多**：一个源可以链接到多个目标
- **幂等性**：可安全重复执行，已正确链接的文件会自动跳过
- **失效清理**：自动移除目标目录中源端已不存在的符号链接

## 命令行

```sh
skillink [root]            # 通过符号链接同步文件
skillink lock [files...]   # 加密文件为 .lock 文件
skillink unlock [files...] # 还原 .lock 文件
skillink --yes, -y         # 跳过所有交互确认
skillink --version         # 显示版本
skillink --help            # 显示帮助
```

### 同步行为

- `--yes` 为严格模式：如果目标目录已存在且不是符号链接，会直接抛错并终止
- 交互模式使用下拉选择（不是 y/n）
- 当目标目录已存在且不是符号链接时，可选择：
  - `删除并覆盖`
  - `跳过该映射`
- `.gitignore` 会检测已存在条目并跳过；同一轮重复条目会自动去重
- 同步结束后会输出“共处理多少条映射”

### 报错语言规则

- `locale: 'auto'`：中英双语输出
- `locale: 'zh-CN'`：仅中文
- `locale: 'en'`：仅英文

### Windows 说明

- Windows 下目录链接使用 `junction`，兼容性更好
- Windows 下文件符号链接可能需要开启开发者模式或更高权限
- 若创建文件符号链接报 `EPERM`，请开启开发者模式或以管理员权限运行终端

### 加密 / 还原

使用 `lock` 和 `unlock` 命令加密敏感配置文件（如 `.mcp.json`、`.env`），使其可以安全提交到版本控制。

```bash
# 加密配置中的文件（默认: .mcp.json）
skillink lock

# 加密指定文件
skillink lock .env .mcp.json

# 还原配置中的文件
skillink unlock

# 还原指定文件
skillink unlock .mcp.json
```

在 `skillink.config.ts` 中配置需要加密的文件列表：

```typescript
export default {
  // ...
  encrypt: ['.mcp.json', '.env'],
};
```

- `lock` 读取文件内容，使用 AES-256-CBC 加密后写入 `.lock` 文件，原始文件保留
- `unlock` 读取 `.lock` 文件解密还原，存在则替换、不存在则创建，`.lock` 文件保留
- 原始文件和 `.lock` 文件均保留，由你决定哪些提交到版本控制

## 编程接口

```typescript
import { defineConfig, loadConfig } from '@boses/skillink';
```

## Git 建议

- 推荐提交：`skillink.config.ts`、`AGENTS.md`、`.agents/**`
- 忽略：链接目标（如 `CLAUDE.md`、`.claude/`）
- `npx @boses/skillink` 会提示将这些路径添加到 `.gitignore`

## 许可证

MIT
