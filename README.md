# Skillink

[![npm version](https://img.shields.io/npm/v/@boses/skillink.svg)](https://www.npmjs.com/package/@boses/skillink)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](./README.md) | [简体中文](./README.zh-CN.md)

**Skillink** is a robust symlink manager designed specifically for AI tool configurations.

In the rapidly evolving AI landscape, tools are beginning to converge on standards like `AGENTS.md` and `.agents/`. However, many ecosystems (like Claude Code) still maintain their own fragmented directories. Skillink bridges this gap by synchronizing your agent definitions and skills across all your tools using smart symlinks.

> **Core Philosophy:** Write once, sync everywhere, stay compatible.

## ✨ Key Features

- **🚀 Smart Initialization**: Interactive onboarding that detects your system language and sets up `.gitignore` automatically.
- **🔗 Unified Syncing**: Resolve complex glob patterns (e.g., `**/AGENTS.md`) into flat symlink structures.
- **🛡️ Secure Encryption**: Protect sensitive MCP configs or `.env` files using industry-standard **AES-256-GCM** with integrity checks.
- **🖥️ Cross-Platform**: Optimized for macOS, Linux, and Windows (uses Junctions and provides elevation fallbacks).
- **🌐 Bilingual Support**: Intelligent `auto` locale detection with clear, professional output in both English and Chinese.
- **⚙️ Developer-First CLI**: Supports interactive prompts, CLI flags (`--yes`), and environment variables for CI/CD.

## 🚀 Quick Start

```bash
npx @boses/skillink
```

On your first run, Skillink will:
1.  **Ask** for your preferred language.
2.  **Generate** a `skillink.config.ts` if it doesn't exist.
3.  **Scan** for `AGENTS.md` and `.agents/` directories.
4.  **Prompt** to add generated targets to your `.gitignore`.
5.  **Create** the symlinks to bridge your AI tools.

### Automation Mode (CI/CD)

```bash
npx @boses/skillink --yes
```

## 🛠 Configuration

Edit `skillink.config.ts` to customize your linking logic:

```typescript
import { defineConfig } from '@boses/skillink';

export default defineConfig({
  locale: 'auto', // 'auto' | 'en' | 'zh-CN'
  
  // File rules: Sync documentation across tools
  agentsMarkdown: [
    {
      from: '**/AGENTS.md',
      to: ['CLAUDE.md'],
    },
  ],
  
  // Directory rules: Sync skill directories
  agentsSkills: [
    {
      from: '.agents',
      to: ['.claude'],
    },
  ],
  
  // Sensitive files to be encrypted via 'lock' command
  encrypt: ['.mcp.json', '.env'],
});
```

## ⌨️ CLI Usage

| Command | Description |
| :--- | :--- |
| `skillink [root]` | Sync files via symlinks (default command) |
| `skillink lock [files...]` | Encrypt files to `.lock` format |
| `skillink unlock [files...]` | Decrypt `.lock` files back to originals |
| `-y, --yes` | Skip confirmation prompts (Strict Mode) |
| `-p, --password <pwd>` | Provide password for lock/unlock (or use `SKILLINK_PASSWORD` env) |
| `--version` | Show version |

### Sync Behavior & Safety

- **Conflict Handling**: If a target (e.g., `CLAUDE.md`) exists and is a **real file/directory** (not a link), Skillink will prompt you to `Overwrite` or `Skip`.
- **Strict Mode (`--yes`)**: In automation mode, Skillink prioritizes safety. If a conflict is detected, it will **fail and exit** rather than silently overwriting your data.
- **Root Boundary**: All resolved `from` / `to` paths must stay within the current project root. Any mapping that escapes the root via paths like `../` will be rejected.
- **Idempotency**: Safe to run repeatedly; it only updates links that have changed.

## 🔒 Security (Lock/Unlock)

Use `lock` to encrypt sensitive files so they can be committed to version control safely.

```bash
# Encrypts files listed in config. Prompts for password if not provided via -p or env.
skillink lock

# Decrypts and restores originals
skillink unlock
```

- **Algorithm**: AES-256-GCM (Authenticated Encryption).
- **Manifest**: Tracks encrypted files in `skillink.encrypt.json` for easy restoration.
- **Privacy**: Original files and `.lock` files are kept locally; you decide what to commit.

## 🤝 Contributing

Contributions are welcome! Whether it's reporting a bug, suggesting a feature, or submitting a pull request, we appreciate your help in making Skillink better.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add some amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.
