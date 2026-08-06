# create-hsi-app

Interactive CLI to kick start a frontend project.

## The Hsi-App Stack

An opinionated web development stack focused on simplicity, development experience, and best practices. The stack includes:

- Vite or Next.js App Router SPA export
- React 19
- TypeScript 6
- Lucide React by default
- Optional TanStack React Query
- Styled or minimal starter CSS
- ESLint with `eslint-config-complete`
- Prettier with sorted imports
- Husky and lint-staged pre-commit checks for generated git repositories
- VS Code extension recommendations for lint, format, spellcheck, and syntax highlighting
- VS Code auto lint/format settings
- Package-age gating for supply-chain security

## Getting Started

Run any one of these:

### npm

```bash
npm create hsi-app@latest
```

### yarn

```bash
yarn create hsi-app
```

### pnpm

```bash
pnpm create hsi-app@latest
```

### bun

```bash
bun create hsi-app@latest
```

Full CLI usage, flags, and repo/install behavior are documented in
[`docs/CLI.md`](./docs/CLI.md).
