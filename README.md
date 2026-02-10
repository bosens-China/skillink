# Skillink 🚀

[English](./README.md) | [简体中文](./README.zh-CN.md)

**Skillink** is a skill linker for AI tools.  
Write skills in one place (`.agents/skills`) and sync to multiple tool directories with symlinks/junctions.

> Core idea: **Write once, use everywhere.**

## Features

- Minimal architecture with Node.js 20+ and TypeScript
- Symlink-based sync (no copy, instant effect)
- Interactive `init` flow
- `sync --watch` for real-time skill folder changes
- Safe clean behavior (only removes links under source boundary)
- CLI localization via config (`en` / `zh-CN`)

## Install

Install as a dev dependency:

```bash
# pnpm
pnpm add -D @boses/skillink

# npm
npm install -D @boses/skillink

# yarn
yarn add -D @boses/skillink
```

## Quick Start

### 1) Initialize

```bash
npx skillink init
```

The first step in `init` asks language (`English / 简体中文`), then it creates:

- `.agents/skills` (with an example skill)
- `skillink.config.ts`

### 2) Write skills

```text
.agents/skills/
└── react-expert/
    └── SKILL.md
```

### 3) Sync

```bash
npx skillink sync
```

Watch mode:

```bash
npx skillink sync --watch
```

## Commands

| Command  | Description                                                                          |
| :------- | :----------------------------------------------------------------------------------- |
| `init`   | Initialize project and create config.                                                |
| `sync`   | Sync skills to all enabled targets (`--watch` supported).                            |
| `status` | Show detailed sync status.                                                           |
| `clean`  | Remove generated symlinks from configured targets.                                   |
| `check`  | Check updates by semantic versions from npm `versions` (no `latest` tag dependency). |

## Configuration (`skillink.config.ts`)

```typescript
import { defineConfig } from '@boses/skillink';

export default defineConfig({
  // CLI locale: 'en' | 'zh-CN' (default: 'en')
  locale: 'en',
  // Skills source directory
  source: '.agents/skills',
  // Sync targets
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

## Git Recommendation

- Commit: `skillink.config.ts`, `.agents/skills/**`
- Avoid committing generated link targets (for example: `.cursor/rules`, `.gemini/skills`)
- `init` will remind you to add target directories to `.gitignore`

## License

MIT
