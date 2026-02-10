# Skillink 🚀

[English](./README.md) | [简体中文](./README.zh-CN.md)

**Skillink** 是一个 AI Skills 链接工具。  
你可以在统一目录（`.agents/skills`）编写技能，并通过符号链接（Symlink/Junction）同步到多个 AI 工具目录。

> 核心理念：**一次编写，处处生效。**

## 特性

- Node.js 20+ + TypeScript 的简洁架构
- 基于符号链接同步，零拷贝、即时生效
- 交互式 `init` 初始化流程
- `sync --watch` 支持实时监听技能目录变化
- 安全清理策略（仅清理位于 source 边界内的链接）
- 支持 CLI 国际化输出（`en` / `zh-CN`）

## 安装

推荐安装为开发依赖：

```bash
# pnpm
pnpm add -D @boses/skillink

# npm
npm install -D @boses/skillink

# yarn
yarn add -D @boses/skillink
```

## 快速开始

### 1）初始化

```bash
npx skillink init
```

`init` 第一步会先询问语言（`English / 简体中文`），然后自动创建：

- `.agents/skills`（包含示例技能）
- `skillink.config.ts`

### 2）编写技能

```text
.agents/skills/
└── react-expert/
    └── SKILL.md
```

### 3）同步

```bash
npx skillink sync
```

监听模式：

```bash
npx skillink sync --watch
```

## 命令

| 命令     | 说明                                                               |
| :------- | :----------------------------------------------------------------- |
| `init`   | 初始化项目并生成配置。                                             |
| `sync`   | 同步技能到所有启用目标（支持 `--watch`）。                         |
| `status` | 显示详细同步状态。                                                 |
| `clean`  | 清理配置目标中的已生成符号链接。                                   |
| `check`  | 基于 npm `versions` 的语义化版本检查更新（不依赖 `latest` 标签）。 |

## 配置说明（`skillink.config.ts`）

```typescript
import { defineConfig } from '@boses/skillink';

export default defineConfig({
  // CLI 语言: 'en' | 'zh-CN'（默认: 'en'）
  locale: 'en',
  // 技能源目录
  source: '.agents/skills',
  // 同步目标
  targets: [
    {
      name: 'cursor',
      path: '.cursor/rules',
      enabled: true,
    },
    {
      name: 'gemini',
      path: '.gemini/skills',
      enabled: true,
    },
  ],
});
```

## Git 建议

- 推荐提交：`skillink.config.ts`、`.agents/skills/**`
- 不建议提交：链接产物目录（如 `.cursor/rules`、`.gemini/skills`）
- `init` 完成后会提示将目标目录加入 `.gitignore`

## 许可证

MIT
