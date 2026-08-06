# CLI Advanced Usage

- `[dir]`: scaffold into a new directory instead of the current one
- `--vite`: scaffold a Vite app without showing the framework prompt
- `--next`: scaffold a Next.js App Router SPA export without showing the framework prompt
- `--bun`: use Bun for the scaffolded app and write `bunfig.toml`
- `--npm`: use npm for the scaffolded app and write `.npmrc`
- `--pnpm`: use pnpm for the scaffolded app and write `pnpm-workspace.yaml`
- `--yarn`: use Yarn for the scaffolded app and write `.yarnrc.yml`
- `--styled`: include the styled starter and design tokens without showing the
  styling prompt
- `--minimal`: include only a minimal global CSS reset without showing the
  styling prompt
- `--lucide`: include Lucide React without showing the icon prompt (default)
- `--noLucide`: omit Lucide React without showing the icon prompt
- `--query`: include TanStack Query and its provider without showing the query
  prompt
- `--noQuery`: omit TanStack Query without showing the query prompt (default)
- `--noInstall`: skip the default dependency installation step
- `--noRepo`: skip the interactive repository prompt and leave git
  uninitialized

Interactive runs prompt for the framework, package manager, starter styling,
Lucide React, and TanStack Query. Non-interactive runs default to Vite, Bun,
styled CSS, Lucide enabled, and TanStack Query disabled unless overridden by
the flags above.

When the CLI creates a git repository, it keeps the Husky pre-commit hook and
runs lint-staged with the selected package manager. Repo-less scaffolds omit
that git-only tooling.

## Smoke Test

Run the local CLI end-to-end with a temporary target directory:

```bash
bun run smoke
```

That runs the full interactive flow, including git/GitHub setup when available.

Skip repo setup or pass through other CLI flags when needed:

```bash
bun run smoke -- --noRepo
bun run smoke -- --npm --noInstall
bun run smoke -- --next --noInstall --noRepo
bun run smoke -- --vite --npm --minimal --noLucide --query --noInstall --noRepo
```
