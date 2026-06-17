# Skillink

[![npm version](https://img.shields.io/npm/v/@boses/skillink.svg)](https://www.npmjs.com/package/@boses/skillink)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Skillink** 是一个专为 AI 工具配置设计的符号链接（Symlink）管理器。

AI 工具正逐步在 `AGENTS.md` 与 `.agents/` 等标准上达成共识，但仍有不少生态（例如 Claude Code）维持着各自的目录结构。Skillink 用智能软链接同步你的 Agent 定义与技能目录，让一份配置在多个工具之间复用。

> **核心理念：** 一次编写，多端同步，完美兼容。

## ✨ 核心特性

- **🚀 智能初始化**：自动检测仓库现状（优先 `.agents/AGENTS.md`，否则反向使用 `.claude/CLAUDE.md` 作为源），交互式生成配置与 `.gitignore`。
- **🔗 统一同步**：支持 Glob 模式（如 `**/AGENTS.md`），自动解析为扁平化的链接列表。
- **🛡️ 冲突防护**：多个源指向同一目标时直接报错，避免静默覆盖；目标已是真实文件时弹窗确认。
- **🔐 安全加密**：基于 AES-256-GCM（带完整性校验）加密敏感配置文件，`lock` 后还会提示把明文加入 `.gitignore`。
- **🖥️ 跨平台**：macOS / Linux / Windows 全面支持（Windows 使用 Junction，必要时降级为硬链接）。
- **⚙️ CI 友好**：`--yes` 全量自动确认；`-p` 或 `SKILLINK_PASSWORD` 注入密码；非 TTY 缺密码会快速失败而不是挂死。

## 🚀 快速开始

```bash
npx @boses/skillink
```

首次运行 Skillink 会：

1. **检测** 仓库中现有的 `.agents` / `AGENTS.md` 或 `.claude` / `CLAUDE.md`
2. **生成** `skillink.config.ts`（按检测结果选择正向或反向模板）
3. **解析** 配置，展示即将创建的映射摘要
4. **确认** 是否把生成目标写入 `.gitignore`
5. **创建** 符号链接，桥接你的 AI 工具

### 自动化模式（CI/CD）

```bash
npx @boses/skillink --yes
```

### 预览模式（不写盘）

```bash
npx @boses/skillink --dry-run
```

## 🛠 配置说明

编辑 `skillink.config.ts` 自定义同步逻辑：

```typescript
import { defineConfig } from '@boses/skillink';

export default defineConfig({
  // 文件规则：同步文档类配置，遵守 .gitignore
  agentsMarkdown: [
    {
      from: '**/AGENTS.md',
      to: ['CLAUDE.md'],
    },
  ],

  // 目录规则：目标与源目录同级
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

| 命令                          | 描述                                                    |
| :---------------------------- | :------------------------------------------------------ |
| `skillink [root]`             | 通过符号链接同步文件（默认命令）                        |
| `skillink lock [...files]`    | 将文件加密为 `.lock`                                    |
| `skillink unlock [...files]`  | 将 `.lock` 文件解密还原                                 |
| `-y, --yes`                   | 跳过所有交互确认（严格模式，冲突直接报错）              |
| `--dry-run`                   | 仅打印将要执行的链接，不写入文件系统                    |
| `-p, --password <pwd>`        | 提供加解密密码（也可使用环境变量 `SKILLINK_PASSWORD`）  |
| `--version`                   | 显示版本号                                              |

### 同步行为与安全

- **冲突防护**：多个 `from` 解析到同一个 `to` 时会立即报错（避免静默后写覆盖前面的链接）。
- **真实文件冲突**：目标路径已存在且不是符号链接时，交互模式会询问「覆盖 / 跳过」，`--yes` 模式直接报错退出。
- **根目录边界**：所有 `from` / `to` 必须落在项目根目录内，`../` 越界会被拒绝。
- **幂等性**：可重复运行，仅重建已变化的链接。

## 🔒 加固命令（Lock / Unlock）

使用 `lock` 加密敏感文件，方便提交到版本控制；`unlock` 一键还原。

```bash
# 加密配置中列出的文件（未提供密码时会交互式询问）
skillink lock

# 解密 .lock 文件，还原原始内容
skillink unlock
```

- **算法**：AES-256-GCM（带完整性认证标签）
- **清单**：`skillink.encrypt.json` 记录被加密的明文路径，便于一键还原
- **明文保护**：`lock` 执行后会主动提示把明文加入 `.gitignore`，避免误提交
- **退出码**：`unlock` 全部/部分解密失败时退出码非 0，便于 CI 检测

## 🤝 参与贡献

欢迎贡献代码！无论是报告 Bug、建议新功能还是提交 Pull Request，我们都非常感谢。

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'feat: add amazing feature'`）
4. 推送分支（`git push origin feature/amazing-feature`）
5. 发起 Pull Request

## 📜 开源协议

本项目采用 **MIT License**。详情请参阅 `LICENSE` 文件。
