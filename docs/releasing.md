# Releasing

This repo is template source plus release tooling. The root package is private.
Only `create-hsi-app` is published to public npm.

## Release Flow

1. Start from a clean worktree on `main`.
2. Make sure GitHub CLI is installed and authenticated:
    - `gh auth status`
3. Run one of:
    - `npm run release`
    - `pnpm run release`
    - `yarn run release`
    - `bun run release`
4. If the current version is not yet on npm, choose whether to release it as-is
   or bump first.
5. Otherwise choose `patch`, `minor`, or `major`.
6. The script will:
    - bump the root `package.json` version
    - bump `packages/create-hsi-app/package.json`
    - update `templateTag` in
      `packages/create-hsi-app/bin/create-hsi-app.mjs`
    - run `check`
    - verify GitHub CLI can create a GitHub release
    - list commits added since the previous `v*` release tag
    - ask for one or more release-note bullet points
    - commit
    - create the matching `v*` tag
    - push `main`
    - push the tag
    - run `npm login --registry=https://registry.npmjs.org`
    - publish `packages/create-hsi-app` to public npm
    - create a matching GitHub release from the pushed tag
    - skip the release commit if no version files changed
    - skip the GitHub release if it already exists
    - require a version bump when the matching `v*` tag already exists on a
      different commit

## Dry Run

Use one of:

- `npm run release -- --dry-run`
- `pnpm run release -- --dry-run`
- `yarn run release --dry-run`
- `bun run release -- --dry-run`

The dry run updates files and runs checks, but skips commit, tag, push, GitHub
release, npm login, and npm publish.

## GitHub Release

GitHub release creation uses the existing tag source archives. It does not
publish a GitHub Package or upload npm artifacts.

Before pushing or publishing, the release script prints the commits since the
previous `v*` release tag and prompts for release-note bullets. It uses those
bullets first, then appends GitHub's generated release notes.

The release body format is:

```md
## What Changed:

- Your release bullet
- Another release bullet

GitHub generated release notes...
```

```bash
gh release create v0.8.0 --title v0.8.0 --notes "$RELEASE_NOTES" --verify-tag
```

## npm Publish

Public npm publish is performed by the release script. npm may prompt you to
press ENTER to open the browser login flow before publishing.

```bash
npm login --registry=https://registry.npmjs.org
npm publish ./packages/create-hsi-app --registry=https://registry.npmjs.org
```

## Legacy Package

Keep `hsi-app` deprecated on npm.

## Notes

- `scripts/` is ignored by npm tarballs.
- `create-hsi-app` removes repo-only tooling from generated apps.
- Direct GitHub template clones still include repo-only tooling by design.
