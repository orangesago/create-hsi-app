module.exports = {
    git: {
        commitMessage: 'chore: release create-hsi-app v${version}',
        tagName: 'v${version}',
    },
    github: {
        autoGenerate: true,
        release: true,
    },
    hooks: {
        'before:bump': 'bun run check',
        'after:bump': 'node scripts/sync-release-version.mjs',
        'before:git:release':
            'git add packages/create-hsi-app/package.json packages/create-hsi-app/bin/create-hsi-app.mjs',
        'after:git:release':
            'npm publish packages/create-hsi-app --registry=https://registry.npmjs.org',
    },
    npm: {
        publish: false,
    },
};
