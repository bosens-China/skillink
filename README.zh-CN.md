# Skillink

[![npm version](https://img.shields.io/npm/v/@boses/skillink.svg)](https://www.npmjs.com/package/@boses/skillink)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](./README.md) | [简体中文](./README.zh-CN.md)

**Skillink** 是一个专为 AI 工具配置设计的强大符号链接（Symlink）管理器。

随着 AI 工具的快速发展，许多工具开始在 `AGENTS.md` 和 `.agents/` 等标准上达成共识。然而，仍有一些生态（如 Claude Code）维持着碎片化的目录结构。Skillink 通过智能软链接同步你的 Agent 定义和技能，桥接不同工具之间的鸿沟。

> **核心理念：** 一次编写，多端同步，完美兼容。

## ✨ 核心特性

- **🚀 智能初始化**：交互式引导，自动检测系统语言并一键配置 `.gitignore`。
- **🔗 统一同步**：支持复杂的 Glob 模式（如 `**/AGENTS.md`），自动解析并建立扁平化的链接结构。
- **🛡️ 安全加密**：使用行业标准的 **AES-256-GCM** 算法加密敏感的 MCP 配置或 `.env` 文件，并附带完整性校验。
- **🖥️ 跨平台优化**：针对 macOS、Linux 和 Windows 进行了深度优化（Windows 下使用 Junction，并提供权限提升降级方案）。
- **🌐 深度国际化**：智能 `auto` 语言检测，提供专业的中英双语输出。
- **⚙️ 开发者优先**：支持交互式提示、命令行参数（`--yes`）和环境变量（CI/CD 友好）。

## 🚀 快速开始

```bash
npx @boses/skillink
```

在首次运行时，Skillink 将：
1.  **询问** 你的语言偏好。
2.  **生成** `skillink.config.ts` 配置文件（如果不存在）。
3.  **扫描** 项目中的 `AGENTS.md` 和 `.agents/` 目录。
4.  **提示** 将生成的目标路径加入 `.gitignore`。
5.  **创建** 软链接，桥接你的 AI 工具。

### 自动化模式 (CI/CD)

```bash
npx @boses/skillink --yes
```

## 🛠 配置说明

编辑 `skillink.config.ts` 自定义同步逻辑：

```typescript
import { defineConfig } from '@boses/skillink';

export default defineConfig({
  locale: 'auto', // 'auto' | 'en' | 'zh-CN'
  
  // 文件规则：同步文档类配置
  agentsMarkdown: [
    {
      from: '**/AGENTS.md',
      to: ['CLAUDE.md'],
    },
  ],
  
  // 目录规则：同步技能目录
  agentsSkills: [
    {
      from: '.agents',
      to: ['.claude'],
    },
  ],
  
  // 需要通过 lock 命令加密的敏感文件
  encrypt: ['.mcp.json', '.env'],
});
```

## ⌨️ CLI 命令

| 命令 | 描述 |
| :--- | :--- |
| `skillink [root]` | 通过符号链接同步文件（默认命令） |
| `skillink lock [files...]` | 将文件加密为 `.lock` 格式 |
| `skillink unlock [files...]` | 将 `.lock` 文件解密还原 |
| `-y, --yes` | 跳过所有交互确认（严格模式） |
| `-p, --password <pwd>` | 提供加解密密码（也可使用 `SKILLINK_PASSWORD` 环境变量） |
| `--version` | 显示版本号 |

### 同步行为与安全

- **冲突处理**：如果目标路径（如 `CLAUDE.md`）已存在且是一个**真实文件/目录**（非软链接），Skillink 会提示你选择 `覆盖` 或 `跳过`。
- **严格模式 (`--yes`)**：在自动化场景中，安全第一。如果检测到冲突，Skillink 会 **报错并退出**，而不是静默覆盖你的原始数据。
- **根目录边界**：所有解析后的 `from` / `to` 路径都必须位于当前项目根目录内。像 `../` 这类会逃逸出根目录的映射会被直接拒绝。
- **幂等性**：支持多次运行，仅更新已变更的链接。

## 🔒 安全加固 (Lock/Unlock)

使用 `lock` 加密敏感文件，以便安全地提交到版本控制。

```bash
# 加密配置中列出的文件。未通过 -p 或环境变量提供密码时会弹出交互提示。
skillink lock

# 解密并还原原始文件
skillink unlock
```

- **算法**：AES-256-GCM（带认证的加密）。
- **清单**：在 `skillink.encrypt.json` 中记录加密文件，方便一键还原。
- **隐私**：原始文件与 `.lock` 文件均保留在本地，由你决定提交哪些。

## 🤝 参与贡献

欢迎贡献代码！无论是报告 Bug、建议新功能还是提交 Pull Request，我们都非常感谢你对 Skillink 的支持。

1.  Fork 本仓库。
2.  创建你的特性分支 (`git checkout -b feature/amazing-feature`)。
3.  提交你的更改 (`git commit -m 'Add some amazing feature'`)。
4.  推送到分支 (`git push origin feature/amazing-feature`)。
5.  发起 Pull Request。

## 📜 开源协议

本项目采用 **MIT License**。详情请参阅 `LICENSE` 文件。
