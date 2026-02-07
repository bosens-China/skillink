# @boses/skillink

统一 AI Skills 管理工具 - 像 pnpm 一样链接到各 AI 工具目录。

## 问题背景

现在有很多 AI 工具支持 skills（如 Cursor、Gemini CLI 等），但每家的文件夹路径都不同：

| AI 工具 | Skills 路径 |
|---------|------------|
| Cursor | `.cursor/skills/` |
| Claude | `.claude/skills/` |
| Codex | `.codex/skills/` |
| Gemini CLI | `.gemini/skills/` |

这导致同一个 skill 需要复制多份，无法复用和同步。

## 解决方案

**Skillink** 借鉴 pnpm 的链接机制：

1. 在 `.agent/skills/` 统一维护所有 skills
2. 通过符号链接（symlink）分发到各 AI 工具目录
3. 一次修改，处处同步

```text
my-project/
├── .agent/
│   ├── config.json          # 配置要同步的 AI 工具
│   └── skills/              # 统一维护 skills
│       └── my-skill/
│           └── SKILL.md
├── .cursor/
│   └── skills/
│       └── my-skill -> ../../.agent/skills/my-skill  (symlink)
├── .claude/
│   └── skills/
│       └── my-skill -> ../../.agent/skills/my-skill  (symlink)
├── .codex/
│   └── skills/
│       └── my-skill -> ../../.agent/skills/my-skill  (symlink)
└── .gemini/
    └── skills/
        └── my-skill -> ../../.agent/skills/my-skill  (symlink)
```

## 环境要求

- **Node.js >= 20.0.0**

## 安装

```bash
# 全局安装
npm install -g @boses/skillink

# 或使用 pnpm（推荐）
pnpm add -g @boses/skillink
```

## 快速开始

### 1. 初始化项目

```bash
cd my-project
skillink init
```

交互式选择要支持的 AI 工具（默认全选）：
```text
? 选择要同步的 AI 工具 (按空格选择/取消，回车确认):
◉ Cursor  →  .cursor/skills
◉ Claude  →  .claude/skills  (Cursor 兼容)
◉ Codex   →  .codex/skills   (Cursor 兼容)
◉ Gemini  →  .gemini/skills
```

### 2. 添加 Skills

**方式一：手动添加**

将 skill 文件夹放入 `.agent/skills/`：
```bash
mkdir .agent/skills/my-skill
echo "# My Skill" > .agent/skills/my-skill/SKILL.md
```

**方式二：使用模板创建**

```bash
skillink add my-skill
```

### 3. 同步到各 AI 工具

```bash
skillink sync
```

输出示例：
```text
同步 Skills
─────────
ℹ 扫描到 2 个 skills:
  ✓ code-review (valid)
  ✓ git-commit (valid)

code-review
  → cursor .cursor/skills/code-review
  → claude .claude/skills/code-review
  → codex .codex/skills/code-review
  → gemini .gemini/skills/code-review

git-commit
  → cursor .cursor/skills/git-commit
  → claude .claude/skills/git-commit
  → codex .codex/skills/git-commit
  → gemini .gemini/skills/git-commit

✓ 同步完成: 8 创建, 0 更新, 0 跳过, 0 错误
```

### 4. 开发时自动同步（可选）

```bash
skillink watch
```

修改 `.agent/skills/` 中的文件会自动同步到各 AI 工具目录。

## 命令列表

| 命令 | 描述 |
|------|------|
| `skillink init` | 初始化 .agent 目录和配置 |
| `skillink config` | 修改 AI 工具配置（交互式） |
| `skillink sync` | 同步 skills 到各 AI 工具目录 |
| `skillink status` | 查看当前状态 |
| `skillink watch` | 监视模式，自动同步变更 |
| `skillink add [name]` | 创建新的 skill 模板 |

## 配置说明

`.agent/config.json`：

```json
{
  "version": "1.0.0",
  "targets": {
    "cursor": {
      "enabled": true,
      "path": ".cursor/skills"
    },
    "claude": {
      "enabled": true,
      "path": ".claude/skills"
    },
    "codex": {
      "enabled": true,
      "path": ".codex/skills"
    },
    "gemini": {
      "enabled": true,
      "path": ".gemini/skills"
    }
  },
  "options": {
    "syncMode": "symlink",
    "backupOnConflict": true
  }
}
```

### 配置字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `targets` | object | 目标 AI 工具配置 |
| `targets.{id}.enabled` | boolean | 是否启用该工具 |
| `targets.{id}.path` | string | 该工具的 skills 目录路径 |
| `options.syncMode` | `"symlink" \| "copy"` | 同步模式，默认 symlink |
| `options.backupOnConflict` | boolean | 冲突时是否备份，默认 true |

## SKILL.md 格式

Skillink 使用标准的 Agent Skills 格式：

```markdown
---
name: my-skill
description: 描述这个 skill 的用途
---

## 使用场景

- 场景 1
- 场景 2

## 示例

~~~
示例代码或提示词
~~~

## 注意事项

1. 注意事项 1
2. 注意事项 2
```

## 跨平台支持

| 平台 | 链接类型 | 说明 |
|------|----------|------|
| **macOS/Linux** | Symbolic Link | 标准符号链接 |
| **Windows** | Junction (目录) / Symlink (文件) | 目录使用 junction（无需管理员权限），文件 symlink 失败时自动 fallback 到 copy |

## 技术栈

- **Runtime**: Node.js 20+ (ESM)
- **Build**: tsup (快速打包)
- **CLI**: Commander.js + @inquirer/prompts
- **文件监听**: chokidar
- **终端颜色**: picocolors

## License

MIT
