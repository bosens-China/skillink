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
2. Symlink every `AGENTS.md` matched by glob (respecting `.gitignore`) → `CLAUDE.md` next to each file
3. Symlink `.agents/` → `.claude/` beside the source directory
4. Prompt to add linked paths to `.gitignore`

### Skip Prompts

```bash
npx @boses/skillink --yes
```

## Configuration

After first run, edit `skillink.config.ts`:

```typescript
export default {
  locale: 'auto', // 'auto' | 'en' | 'zh-CN'
  // Agent docs: glob (gitignore-aware); each `to` is relative to each matched file's directory
  agentsMarkdown: [
    {
      from: '**/AGENTS.md',
      to: ['CLAUDE.md'],
    },
  ],
  // Skills dirs: each `to` is beside the matched source dir (same parent as `.agents`)
  agentsSkills: [
    {
      from: '.agents',
      to: ['.claude'],
    },
  ],
  // Optional extra symlinks (no glob)
  // links: [{ from: 'extra.txt', to: 'extra.link.txt' }],
  encrypt: ['.mcp.json'],
};
```

All top-level fields are optional. `export default {}` is valid: **sync** will resolve zero mappings and exit without error (aside from optional `.gitignore` prompts when there are no targets).

One logical source can still map to many targets by listing multiple entries in `to`, or by adding more rules under `agentsMarkdown` / `agentsSkills`.

### Locale

| Value   | Behavior                                 |
| :------ | :--------------------------------------- |
| `auto`  | Detect system language, bilingual output |
| `en`    | English only                             |
| `zh-CN` | Chinese only                             |

## How It Works

- **File rules (`agentsMarkdown`)**: e.g. `**/AGENTS.md` with `to: ['CLAUDE.md']` creates `CLAUDE.md` next to each matched `AGENTS.md` (glob respects `.gitignore`, including nested ignore files when using the default matcher).
- **Directory rules (`agentsSkills`)**: e.g. `.agents` → `.claude` means a directory symlink at `.claude` pointing to `.agents` (targets are siblings of the source directory).
- **Optional `links`**: literal `from`/`to` pairs for anything else.
- **One-to-many**: Multiple entries in `to`, or multiple rules.
- **Idempotent**: Safe to run multiple times, skips already-correct links

## CLI

```sh
skillink [root]          # Sync files via symlinks
skillink lock [files...] # Encrypt files to .lock files
skillink unlock [files...] # Decrypt .lock files back to originals
skillink --yes, -y       # Skip confirmation prompts
skillink --version       # Show version
skillink --help          # Show help
```

### Sync Behavior

- `--yes` mode is strict: if target directory already exists and is not a symlink, Skillink throws and stops
- Interactive mode uses a dropdown (not y/n) for conflict choices
- If target directory exists and is not a symlink, you can choose:
  - `Delete and overwrite`
  - `Skip this mapping`
- Existing `.gitignore` entries are detected and skipped; duplicated entries in one run are de-duplicated
- At the end of sync, Skillink prints how many mappings were processed

### Error Message Locale

- `locale: 'auto'`: bilingual output (Chinese + English)
- `locale: 'zh-CN'`: Chinese only
- `locale: 'en'`: English only

### Windows Notes

- Directory links use `junction` on Windows for better compatibility
- File symlinks on Windows may require Developer Mode or elevated permissions
- If file symlink creation fails with `EPERM`, enable Developer Mode or run terminal as Administrator

### Encrypt / Decrypt

Use `lock` and `unlock` to encrypt sensitive config files (e.g. `.mcp.json`, `.env`) so they can be committed to version control without exposing secrets.

```bash
# Encrypt files listed in config (default: .mcp.json)
skillink lock

# Encrypt specific files
skillink lock .env .mcp.json

# Decrypt: with no args, uses paths listed in skillink.encrypt.json if present; otherwise falls back to `encrypt` in config
skillink unlock

# Decrypt specific files only
skillink unlock .mcp.json
```

Configure default candidates for `lock` (and `unlock` fallback) in `skillink.config.ts`:

```typescript
export default {
  // ...
  encrypt: ['.mcp.json', '.env'],
};
```

- `lock` writes AES-256-CBC ciphertext next to each file as `*.lock`, keeps originals, and **merges relative paths into `skillink.encrypt.json`**
- `unlock` restores plaintext from `*.lock`; with no file arguments it prefers the manifest list
- Original files and `.lock` files are both preserved — you control what goes into version control

## Programmatic Usage

```typescript
import { defineConfig, loadConfig, resolveLinkMappings } from '@boses/skillink';
```

## Git Recommendation

- Commit: `skillink.config.ts`, `skillink.encrypt.json` (optional), `AGENTS.md`, `.agents/**`
- Ignore: linked targets (e.g. `CLAUDE.md`, `.claude/`)
- `npx @boses/skillink` will prompt to add these to `.gitignore`

## License

MIT
