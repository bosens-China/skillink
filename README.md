# Skillink

[![npm version](https://img.shields.io/npm/v/@boses/skillink.svg)](https://www.npmjs.com/package/@boses/skillink)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

为 AI 工具配置设计的同步管理器。一份 `AGENTS.md` / `.agents` 配置，自动同步成各家工具（如 Claude Code 的 `CLAUDE.md` / `.claude`）所需的文件，避免重复维护。

## 特性

- 智能初始化：自动检测仓库现状（优先 `.agents` / `AGENTS.md`，否则反向以 `.claude` / `CLAUDE.md` 为源），生成配置与 `.gitignore`。
- 统一同步：支持 Glob（如 `**/AGENTS.md`），自动展开为扁平映射列表。
- 两种同步方式：`symlink`（默认，软链接，单一数据源）与 `copy`（复制真实内容，可被 git 提交、在不跟随软链接的环境也可用）。支持全局设定与按规则覆盖。
- 安装即同步：在项目 `postinstall` 中调用 `npx @boses/skillink --silent`，`install` 后自动同步一次，无配置则静默退出、绝不阻断安装。
- 冲突防护：多个源指向同一目标时报错；目标为用户已有文件时确认；`symlink` ↔ `copy` 切换时确认。
- 敏感文件加密：基于 AES-256-GCM 的 `lock` / `unlock`，加密后可安全提交。
- 跨平台：macOS / Linux / Windows（Windows 使用 Junction，必要时降级为硬链接）。

## 快速开始

```bash
npx @boses/skillink
```

首次运行会：检测仓库现状 → 生成 `skillink.config.ts` → 解析并展示映射 → 确认写入 `.gitignore` → 创建链接。

```bash
npx @boses/skillink --yes        # CI：跳过所有交互确认
npx @boses/skillink --dry-run    # 仅预览，不写盘
npx @boses/skillink --mode copy  # 首次生成配置时指定同步方式
```

## 配置

编辑 `skillink.config.ts`：

```typescript
import { defineConfig } from '@boses/skillink';

export default defineConfig({
  // 全局同步方式：'symlink'（默认）或 'copy'，可被单条规则的 mode 覆盖
  mode: 'symlink',

  // 文件规则：Glob 匹配，遵守 .gitignore，to 相对每个匹配文件所在目录
  agentsMarkdown: [
    {
      from: '**/AGENTS.md',
      to: ['CLAUDE.md'],
      // mode: 'copy', // 仅这条改用 copy
    },
  ],

  // 目录规则：to 与命中的源目录同级
  agentsSkills: [
    {
      from: '.agents',
      to: ['.claude'],
    },
  ],

  // lock 默认加密的敏感文件
  encrypt: ['.mcp.json', '.env'],
});
```

## 同步方式：symlink 与 copy

| 维度          | `symlink`（默认）          | `copy`                           |
| :------------ | :------------------------- | :------------------------------- |
| 目标内容      | 软链接，指向源             | 复制出的真实文件 / 目录          |
| 数据源        | 单一，改任一侧等价         | 两份独立副本，源变后需再次同步   |
| `.gitignore`  | 自动加入忽略               | 自动移出忽略，以便提交           |
| 提交 / 跨平台 | 依赖软链接支持（Windows 受限） | 任意环境都能读到真实内容     |
| 适用场景      | 本地多工具复用一份配置     | 镜像需提交进仓库，或团队含 Windows |

- 初始化时指定：`--mode copy` / `--mode symlink`（仅 init 生效，配置已存在时忽略）。未指定时，以 `.claude` / `CLAUDE.md` 为源的反向场景默认 `copy`，其余默认 `symlink`。
- 模式切换：改动 `mode` 后再次运行，会先删除现有形态再重建。交互模式确认「将删除…并重建为…」，`--yes` 自动执行并打印一行提示，`--silent` 静默执行。切换由 `skillink.copy.json` 清单追踪归属，不会误删同名的用户文件；源被删除后对应副本会被清理。

## 安装后自动同步（postinstall）

在你自己项目的 `package.json` 中：

```jsonc
{
  "scripts": {
    "postinstall": "npx @boses/skillink --silent"
  }
}
```

`--silent` 为 `postinstall` 设计：无 `skillink.config.*` 时静默退出（不在安装阶段生成配置）；全程非交互；与用户文件冲突时跳过而非报错；仅在确有新建时打印一行摘要。

## CLI

未全局安装时，用 `npx @boses/skillink ...` 调用。

| 命令 / 选项                  | 说明                                                  |
| :--------------------------- | :---------------------------------------------------- |
| `[root]`                     | 同步文件（默认命令，支持 symlink / copy）             |
| `lock [...files]`            | 将文件加密为 `.lock`                                  |
| `unlock [...files]`          | 将 `.lock` 解密还原                                   |
| `-y, --yes`                  | 跳过所有交互确认（与用户文件冲突时报错退出）          |
| `--dry-run`                  | 仅打印将要执行的同步，不写盘                          |
| `--silent`                   | 安静模式（postinstall 用：无配置即退出、不交互、冲突跳过） |
| `--mode <symlink\|copy>`     | 首次生成配置时的同步方式（仅 init 生效）              |
| `-p, --password <pwd>`       | 加解密密码（也可用环境变量 `SKILLINK_PASSWORD`）      |
| `--version`                  | 显示版本号                                            |

### 同步行为与安全

- 冲突防护：多个 `from` 解析到同一个 `to` 时立即报错，避免静默覆盖。
- 用户文件冲突：目标是非 skillink 生成的真实文件时，交互模式询问「覆盖 / 跳过」，`--yes` 报错退出，`--silent` 跳过。
- 模式切换确认：目标是 skillink 生成的另一种形态（symlink ↔ copy）时确认转换，`--yes` / `--silent` 直接执行。
- 根目录边界：所有 `from` / `to` 必须位于项目根目录内，`../` 越界会被拒绝。
- 幂等性：可重复运行；symlink 仅重建已变化的链接，copy 内容一致时不重写。

## 加密命令（lock / unlock）

```bash
npx @boses/skillink lock     # 加密配置中列出的文件（未提供密码时交互询问）
npx @boses/skillink unlock   # 解密 .lock，还原原文
```

- 算法：AES-256-GCM（带完整性认证标签）。
- 清单：`skillink.encrypt.json` 记录被加密的明文路径，便于一键还原。
- 明文保护：`lock` 后提示把明文加入 `.gitignore`。
- 退出码：`unlock` 失败时退出码非 0，便于 CI 检测。

## 贡献

欢迎提交 Issue 与 Pull Request。

1. Fork 仓库并创建特性分支
2. 安装依赖 `pnpm install`，开发后运行 `pnpm lint && pnpm check && pnpm test`
3. 提交并发起 Pull Request

## 许可证

[MIT](./LICENSE)
