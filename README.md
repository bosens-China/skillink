# Skillink

[English](./README.md) | [简体中文](./README.zh-CN.md)

**Skillink** is a symlink manager for AI tool configs.
As AI tools gradually unify on `AGENTS.md` and `.agents/`, some (like Claude Code) still maintain their own ecosystem — causing fragmentation when switching tools. Skillink bridges this gap by syncing your configs everywhere with symlinks.

> Core idea: **Write once, use everywhere.**

## Quick Start

```bash
npx @boses/skillink
```

That's it. The tool will:

1. Create `skillink.config.ts` if it doesn't exist
2. Symlink `AGENTS.md` → `CLAUDE.md`
3. Symlink `.agents/` → `.claude/`
4. Prompt to add linked paths to `.gitignore`

### Skip Prompts

```bash
npx @boses/skillink --yes
```

## Configuration

After first run, edit `skillink.config.ts`:

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

The `links` array maps source files/directories to targets. One source can map to multiple destinations:

```typescript
links: [
  { from: 'AGENTS.md', to: 'CLAUDE.md' },
  { from: 'AGENTS.md', to: '.cursor/rules/AGENTS.md' },
  { from: '.agents', to: '.claude' },
  { from: '.agents', to: '.cursor/rules' },
]
```

### Locale

| Value    | Behavior                              |
| :------- | :------------------------------------ |
| `auto`   | Detect system language, bilingual output |
| `en`     | English only                          |
| `zh-CN`  | Chinese only                          |

## How It Works

- **File mapping**: `AGENTS.md` → `CLAUDE.md` creates a single symlink
- **Directory mapping**: `.agents` → `.claude` creates a single directory symlink
- **One-to-many**: A single source can be linked to multiple targets
- **Idempotent**: Safe to run multiple times, skips already-correct links
- **Stale cleanup**: Removes symlinks in target that no longer exist in source

## CLI

```sh
skillink [root]          # Sync files via symlinks
skillink lock [files...] # Encrypt files to .lock files
skillink unlock [files...] # Decrypt .lock files back to originals
skillink --yes, -y       # Skip confirmation prompts
skillink --version       # Show version
skillink --help          # Show help
```

### Encrypt / Decrypt

Use `lock` and `unlock` to encrypt sensitive config files (e.g. `.mcp.json`, `.env`) so they can be committed to version control without exposing secrets.

```bash
# Encrypt files listed in config (default: .mcp.json)
skillink lock

# Encrypt specific files
skillink lock .env .mcp.json

# Decrypt files listed in config
skillink unlock

# Decrypt specific files
skillink unlock .mcp.json
```

Configure which files to encrypt in `skillink.config.ts`:

```typescript
export default defineConfig({
  // ...
  encrypt: ['.mcp.json', '.env'],
});
```

- `lock` reads each file, encrypts it with AES-256-CBC, and writes a `.lock` file alongside the original
- `unlock` reads each `.lock` file, decrypts it, and restores the original (creates or replaces)
- Original files and `.lock` files are both preserved — you control what goes into version control

## Programmatic Usage

```typescript
import { defineConfig, loadConfig } from '@boses/skillink';
```

## Git Recommendation

- Commit: `skillink.config.ts`, `AGENTS.md`, `.agents/**`
- Ignore: linked targets (e.g. `CLAUDE.md`, `.claude/`)
- `npx @boses/skillink` will prompt to add these to `.gitignore`

## License

MIT
