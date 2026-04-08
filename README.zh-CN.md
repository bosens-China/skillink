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
import { defineConfig } from '@boses/skillink';

export default defineConfig({
  locale: 'auto', // 'auto' | 'en' | 'zh-CN'
  links: [
    { from: 'AGENTS.md', to: 'CLAUDE.md' },
    { from: '.agents', to: '.claude' },
  ],
});
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
skillink [root]          # 通过符号链接同步文件
skillink --yes, -y       # 跳过所有交互确认
skillink --version       # 显示版本
skillink --help          # 显示帮助
```

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
