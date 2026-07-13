#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';

import {
    closePrompts,
    confirm,
    fail,
    gap,
    intro,
    ready,
    section,
    select,
    text,
    warn,
} from './ui.mjs';

const templateRepo = 'https://github.com/Hsiii/frontend-template.git';
const templateTag = 'v0.8.0';
const defaultAppName = 'my-app';
const packageManagers = ['bun', 'npm', 'pnpm', 'yarn'];
const nextVersion = '16.2.7';
const rawArgs = process.argv.slice(2);
const parsedArgs = parseCliArgs(rawArgs);
const selectedPackageManager = resolvePackageManager(parsedArgs);
let selectedFramework = resolveFramework(parsedArgs);
let shouldInstallDependencies = !(
    parsedArgs.noInstall || readNpmBooleanFlag('noinstall')
);
const shouldSkipRepoSetup = parsedArgs.noRepo || readNpmBooleanFlag('norepo');
const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
const targetArg = parsedArgs.targetArg ?? '.';
const targetPath = resolve(targetArg);
const appName = toPackageName(basename(targetPath));

main().catch((error) => {
    fail(error.message);
});

async function main() {
    if (existsSync(targetPath) && readdirSync(targetPath).length > 0) {
        fail(`Target directory is not empty: ${targetPath}`);
    }

    intro(appName, targetPath);
    selectedFramework = await planFramework();
    const repoPlan = await planRepoSetup();
    shouldInstallDependencies = await planInstallDependencies();
    closePrompts();

    section(`Cloning ${frameworkLabel(selectedFramework)} template`);
    run('git', [
        '-c',
        'advice.detachedHead=false',
        'clone',
        '--branch',
        templateTag,
        '--depth',
        '1',
        templateRepo,
        targetPath,
    ]);

    rmSync(join(targetPath, '.git'), { force: true, recursive: true });
    rmSync(join(targetPath, '.github'), { force: true, recursive: true });
    rmSync(join(targetPath, 'docs'), { force: true, recursive: true });
    rmSync(join(targetPath, 'packages'), { force: true, recursive: true });
    rmSync(join(targetPath, 'scripts'), { force: true, recursive: true });

    updatePackageJson();
    updateBunLock();
    console.log();
    section('Customizing project files');
    console.log(`- framework: ${frameworkLabel(selectedFramework)}`);
    console.log(`- package.json: name, version, scripts, packageManager`);
    logFrameworkFileChanges();
    console.log(`- .gitignore: framework build artifacts`);
    console.log(`- README.md: install/dev/check commands`);
    console.log(`- package manager config: ${packageManagerConfigFile()}`);
    if (selectedPackageManager === 'bun') {
        console.log(`- bun.lock: package name`);
    }
    updateFrameworkFiles();
    updateAppText();
    updateGitIgnore();
    updatePackageManagerFiles();
    writeAppReadme();

    if (shouldInstallDependencies) {
        console.log();
        section(`Installing dependencies with ${selectedPackageManager}`);
        installDependencies();
    }

    await applyRepoPlan(repoPlan);

    ready(appName, nextSteps());
}

function run(command, args, options = {}) {
    try {
        return execFileSync(command, args, {
            cwd: options.cwd,
            encoding: options.capture ? 'utf8' : undefined,
            stdio: options.capture ? 'pipe' : 'inherit',
        });
    } catch (error) {
        if (options.allowFailure) {
            return null;
        }

        const details = error.stderr?.toString().trim() || error.message;
        fail(`Failed to run: ${command} ${args.join(' ')}\n${details}`);
    }
}

function updatePackageJson() {
    const packageJsonPath = join(targetPath, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    packageJson.name = appName;
    packageJson.version = '0.1.0';
    delete packageJson.repository;
    delete packageJson.publishConfig;
    delete packageJson.packageManager;
    delete packageJson.engines;
    delete packageJson.scripts.prepare;
    delete packageJson.scripts.release;
    if (selectedFramework === 'next') {
        packageJson.scripts.dev = 'next dev';
        packageJson.scripts.build = 'next build';
        delete packageJson.scripts.preview;
        packageJson.scripts.check =
            'tsc -p tsconfig.json --noEmit && eslint . && prettier . --check && next build';
        packageJson.dependencies.next = nextVersion;
        packageJson.devDependencies['@next/eslint-plugin-next'] = nextVersion;
        delete packageJson.devDependencies['@vitejs/plugin-react'];
        delete packageJson.devDependencies.vite;
    } else {
        packageJson.scripts.check =
            'tsc -p tsconfig.json --noEmit && eslint . && prettier . --check && vite build';
    }
    packageJson.packageManager = packageManagerDeclaration();

    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 4)}\n`);
}

function updateBunLock() {
    const lockPath = join(targetPath, 'bun.lock');

    if (!existsSync(lockPath)) {
        return;
    }

    if (selectedPackageManager !== 'bun') {
        rmSync(lockPath, { force: true });
        return;
    }

    const lock = readFileSync(lockPath, 'utf8').replace(
        '"name": "frontend-template"',
        `"name": "${appName}"`
    );

    writeFileSync(lockPath, lock);
}

function updateAppText() {
    if (selectedFramework === 'vite') {
        replaceInFile(
            join(targetPath, 'index.html'),
            '<title>Frontend Template</title>',
            {
                with: `<title>${appName}</title>`,
            }
        );
    }

    writeFileSync(join(targetPath, 'src/components/App.tsx'), appComponent());
}

function updateFrameworkFiles() {
    if (selectedFramework === 'next') {
        writeNextAppFiles();
    }
}

function updateGitIgnore() {
    if (selectedFramework !== 'next') {
        return;
    }

    appendGitIgnoreEntries(['.next/', 'next-env.d.ts']);
}

function updatePackageManagerFiles() {
    rmSync(join(targetPath, 'bunfig.toml'), { force: true });
    rmSync(join(targetPath, '.npmrc'), { force: true });
    rmSync(join(targetPath, 'pnpm-workspace.yaml'), { force: true });
    rmSync(join(targetPath, '.yarnrc.yml'), { force: true });

    switch (selectedPackageManager) {
        case 'bun':
            writeFileSync(
                join(targetPath, 'bunfig.toml'),
                '[install]\nminimumReleaseAge = 604800\n'
            );
            return;
        case 'npm':
            writeFileSync(join(targetPath, '.npmrc'), 'min-release-age=7\n');
            return;
        case 'pnpm':
            writeFileSync(
                join(targetPath, 'pnpm-workspace.yaml'),
                'minimumReleaseAge: 10080\n'
            );
            return;
        case 'yarn':
            writeFileSync(
                join(targetPath, '.yarnrc.yml'),
                'npmMinimalAgeGate: 7d\n'
            );
            return;
        default:
            fail(`Unsupported package manager: ${selectedPackageManager}`);
    }
}

function installDependencies() {
    switch (selectedPackageManager) {
        case 'bun':
            run('bun', ['install'], { cwd: targetPath });
            return;
        case 'npm':
            run('npm', ['install'], { cwd: targetPath });
            return;
        case 'pnpm':
            run('pnpm', ['install'], { cwd: targetPath });
            return;
        case 'yarn':
            run('yarn', ['install'], { cwd: targetPath });
            return;
        default:
            fail(`Unsupported package manager: ${selectedPackageManager}`);
    }
}

function writeAppReadme() {
    const installLine = installCommand();
    const devLine = devCommand();
    const checkLine = checkCommand();
    const securityNote = securityNoteForPackageManager();
    const readme = `# ${appName}

Created from the ${frameworkDescription(selectedFramework)} frontend template.

## Install

\`\`\`bash
${installLine}
\`\`\`

## Develop

\`\`\`bash
${devLine}
\`\`\`

## Check

\`\`\`bash
${checkLine}
\`\`\`

${securityNote}
`;

    writeFileSync(join(targetPath, 'README.md'), readme);
}

async function planFramework() {
    if (parsedArgs.framework || !isInteractive) {
        return selectedFramework;
    }

    const framework = await select({
        message: 'Framework',
        options: [
            { label: 'Vite', value: 'vite' },
            { label: 'Next.js', value: 'next' },
        ],
        initialValue: 'vite',
    });
    gap();

    return framework;
}

async function planInstallDependencies() {
    if (!shouldInstallDependencies || !isInteractive) {
        return shouldInstallDependencies;
    }

    const shouldInstall = await confirm({
        message: `Should I run "${installCommand()}" for you?`,
        initialValue: true,
    });
    gap();

    return shouldInstall;
}

async function planRepoSetup() {
    if (shouldSkipRepoSetup || !isInteractive) {
        return null;
    }

    const shouldCreateRepo = await confirm({
        message: 'Create a git repository?',
        initialValue: true,
    });
    gap();

    if (!shouldCreateRepo) {
        return null;
    }

    const repoPlan = {
        git: true,
        github: false,
    };
    const hasGitHubCli = canUseGitHubCli();

    if (!hasGitHubCli) {
        warn(
            'GitHub CLI is unavailable or not authenticated; keeping a local repository only.'
        );
        gap();
        return repoPlan;
    }

    const shouldCreateGitHubRepo = await confirm({
        message: 'Create a GitHub repository too?',
        initialValue: true,
    });
    gap();

    if (!shouldCreateGitHubRepo) {
        return repoPlan;
    }

    const defaultRepoName = basename(targetPath);
    const repoName = await text({
        message: 'Repository name',
        defaultValue: defaultRepoName,
        placeholder: defaultRepoName,
        validate(value) {
            return value.trim() ? undefined : 'Repository name is required.';
        },
    });
    gap();
    const visibility = await select({
        message: 'Visibility',
        options: [
            { label: 'Private', value: 'private' },
            { label: 'Public', value: 'public' },
        ],
        initialValue: 'private',
    });
    gap();

    return {
        ...repoPlan,
        github: true,
        repoName,
        visibility,
    };
}

async function applyRepoPlan(repoPlan) {
    if (!repoPlan) {
        return;
    }

    console.log();
    section('Initializing local git repository');
    initLocalRepo();

    if (!repoPlan.github) {
        return;
    }

    console.log();
    section('Creating GitHub repository');
    run(
        'gh',
        [
            'repo',
            'create',
            repoPlan.repoName,
            `--${repoPlan.visibility}`,
            '--source=.',
            '--remote=origin',
        ],
        { cwd: targetPath }
    );
}

function initLocalRepo() {
    run('git', ['init', '-b', 'main'], { cwd: targetPath });
    run('git', ['config', 'core.hooksPath', '.githooks'], { cwd: targetPath });
}

function canUseGitHubCli() {
    return (
        run('gh', ['auth', 'status'], {
            cwd: targetPath,
            capture: true,
            allowFailure: true,
        }) !== null
    );
}

function nextSteps() {
    const steps = [];

    if (targetArg !== '.') {
        steps.push(`cd ${targetArg}`);
    }

    if (!shouldInstallDependencies) {
        steps.push(installCommand());
    }

    steps.push(devCommand());

    return steps;
}

function replaceInFile(filePath, searchValue, replacement) {
    const source = readFileSync(filePath, 'utf8');
    writeFileSync(filePath, source.replace(searchValue, replacement.with));
}

function appendGitIgnoreEntries(entries) {
    const gitIgnorePath = join(targetPath, '.gitignore');

    if (!existsSync(gitIgnorePath)) {
        writeFileSync(gitIgnorePath, `${entries.join('\n')}\n`);
        return;
    }

    const source = readFileSync(gitIgnorePath, 'utf8');
    const lines = new Set(source.split('\n').filter(Boolean));
    let nextSource = source;

    for (const entry of entries) {
        if (lines.has(entry)) {
            continue;
        }

        nextSource += nextSource.endsWith('\n') ? `${entry}\n` : `\n${entry}\n`;
        lines.add(entry);
    }

    writeFileSync(gitIgnorePath, nextSource);
}

function toPackageName(value) {
    const name = value
        .trim()
        .toLowerCase()
        .replaceAll(/[\s_]+/g, '-')
        .replaceAll(/[^a-z0-9-.]/g, '')
        .replaceAll(/^[.-]+|[.-]+$/g, '')
        .replaceAll(/-{2,}/g, '-');

    return name || defaultAppName;
}

function parseCliArgs(args) {
    const parsedArgs = {
        framework: null,
        noInstall: false,
        noRepo: false,
        packageManager: null,
        targetArg: null,
    };

    for (const arg of args) {
        switch (arg) {
            case '--vite':
                setFrameworkOverride(parsedArgs, 'vite');
                continue;
            case '--next':
                setFrameworkOverride(parsedArgs, 'next');
                continue;
            case '--bun':
                setPackageManagerOverride(parsedArgs, 'bun');
                continue;
            case '--npm':
                setPackageManagerOverride(parsedArgs, 'npm');
                continue;
            case '--pnpm':
                setPackageManagerOverride(parsedArgs, 'pnpm');
                continue;
            case '--yarn':
                setPackageManagerOverride(parsedArgs, 'yarn');
                continue;
            case '--noInstall':
                parsedArgs.noInstall = true;
                continue;
            case '--noRepo':
                parsedArgs.noRepo = true;
                continue;
            default:
                if (arg.startsWith('--')) {
                    fail(`Unsupported option: ${arg}`);
                }

                if (parsedArgs.targetArg) {
                    fail(`Unexpected argument: ${arg}`);
                }

                parsedArgs.targetArg = arg;
        }
    }

    return parsedArgs;
}

function setFrameworkOverride(parsedArgs, framework) {
    if (parsedArgs.framework && parsedArgs.framework !== framework) {
        fail('Pass only one of --vite or --next.');
    }

    parsedArgs.framework = framework;
}

function setPackageManagerOverride(parsedArgs, packageManager) {
    if (
        parsedArgs.packageManager &&
        parsedArgs.packageManager !== packageManager
    ) {
        fail('Pass only one of --bun, --npm, --pnpm, or --yarn.');
    }

    parsedArgs.packageManager = packageManager;
}

function resolvePackageManager(parsedArgs) {
    return parsedArgs.packageManager ?? 'bun';
}

function resolveFramework(parsedArgs) {
    return parsedArgs.framework ?? 'vite';
}

function readNpmBooleanFlag(name) {
    const value = process.env[`npm_config_${name}`];

    return value === 'true' || value === '';
}

function logFrameworkFileChanges() {
    if (selectedFramework === 'next') {
        console.log(
            `- Next app router files: src/app/layout.tsx, src/app/[[...slug]]/*`
        );
        console.log(`- src/app/global.css: app styles and client bootstrap`);
        console.log(`- Next config: next.config.mjs, next-env.d.ts`);
        console.log(
            `- Vite files removed: index.html, vite.config.mjs, src/main.tsx`
        );
        return;
    }

    console.log(`- index.html: title`);
    console.log(`- src/components/App.tsx: app name`);
}

function writeNextAppFiles() {
    rmSync(join(targetPath, 'index.html'), { force: true });
    rmSync(join(targetPath, 'vite.config.mjs'), { force: true });
    rmSync(join(targetPath, 'src/main.tsx'), { force: true });
    rmSync(join(targetPath, 'src/vite-env.d.ts'), { force: true });
    rmSync(join(targetPath, 'src/global.css'), { force: true });

    const appPath = join(targetPath, 'src/app');
    const catchAllPath = join(appPath, '[[...slug]]');
    mkdirSync(appPath, { recursive: true });
    mkdirSync(catchAllPath, { recursive: true });

    writeFileSync(join(targetPath, 'next-env.d.ts'), nextEnvTypes());
    writeFileSync(join(targetPath, 'next.config.mjs'), nextConfig());
    writeFileSync(join(targetPath, 'eslint.config.mjs'), nextEslintConfig());
    writeFileSync(join(targetPath, 'tsconfig.json'), nextTsconfig());
    writeFileSync(join(appPath, 'layout.tsx'), nextLayout());
    writeFileSync(join(appPath, 'global.css'), nextGlobalCss());
    writeFileSync(join(catchAllPath, 'client.tsx'), nextClientPage());
    writeFileSync(join(catchAllPath, 'page.tsx'), nextPage());
}

function frameworkLabel(framework) {
    switch (framework) {
        case 'vite':
            return 'Vite';
        case 'next':
            return 'Next.js';
        default:
            fail(`Unsupported framework: ${framework}`);
    }
}

function frameworkDescription(framework) {
    switch (framework) {
        case 'vite':
            return 'Vite';
        case 'next':
            return 'Next.js App Router SPA';
        default:
            fail(`Unsupported framework: ${framework}`);
    }
}

function frameworkTitle(framework) {
    switch (framework) {
        case 'vite':
            return 'Vite, React, and TypeScript.';
        case 'next':
            return 'Next.js, React, and TypeScript.';
        default:
            fail(`Unsupported framework: ${framework}`);
    }
}

function appComponent() {
    return `import type { JSX } from 'react';

export function App(): JSX.Element {
    // Keep App.tsx coordinating screens and providers. Extract components early
    // so this never becomes a 3,000-line god file.
    return (
        <main className='app'>
            <section className='app__content'>
                <p className='app__eyebrow'>${appName}</p>
                <h1 className='app__title'>${frameworkTitle(selectedFramework)}</h1>
                <p className='app__description'>
                    A clean baseline with strict tooling, useful tokens, and no
                    unnecessary UI noise.
                </p>
            </section>
        </main>
    );
}
`;
}

function nextEnvTypes() {
    return `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file should not be edited.
`;
}

function nextConfig() {
    return `/** @type {import("next").NextConfig} */
const nextConfig = {
    output: 'export',
    distDir: './dist',
};

export default nextConfig;
`;
}

function nextEslintConfig() {
    return `import nextPlugin from '@next/eslint-plugin-next';
import { completeConfigBase } from 'eslint-config-complete';

export default [
    ...completeConfigBase,

    {
        ignores: ['.next/**', 'dist/**', 'node_modules/**'],
    },

    {
        plugins: {
            '@next/next': nextPlugin,
        },
        rules: {
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs['core-web-vitals'].rules,
            '@stylistic/quotes': [
                'error',
                'single',
                {
                    avoidEscape: true,
                },
            ],
            'import-x/no-unassigned-import': [
                'error',
                {
                    allow: ['**/*.css'],
                },
            ],
        },
    },

    {
        files: ['src/app/**/*.tsx'],
        rules: {
            'complete/no-mutable-return': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            'n/file-extension-in-import': 'off',
            'import-x/no-default-export': 'off',
        },
    },
];
`;
}

function nextTsconfig() {
    return `{
    "compilerOptions": {
        "target": "ES2022",
        "lib": ["DOM", "DOM.Iterable", "ES2022"],
        "allowJs": false,
        "skipLibCheck": true,
        "strict": true,
        "noEmit": true,
        "esModuleInterop": true,
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "resolveJsonModule": true,
        "isolatedModules": true,
        "jsx": "react-jsx",
        "incremental": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true,
        "plugins": [
            {
                "name": "next"
            }
        ],
        "paths": {
            "@/*": ["./src/*"]
        }
    },
    "include": [
        "next-env.d.ts",
        "src/**/*.ts",
        "src/**/*.tsx",
        ".next/dev/types/**/*.ts",
        ".next/types/**/*.ts"
    ],
    "exclude": ["node_modules"]
}
`;
}

function nextLayout() {
    return `import type { JSX, ReactNode } from 'react';
import type { Metadata } from 'next';

import './global.css';

export const metadata: Metadata = {
    title: '${appName}',
    description: 'Created from create-hsi-app.',
};

interface RootLayoutProps {
    readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
    return (
        <html lang='en'>
            <body>{children}</body>
        </html>
    );
}
`;
}

function nextClientPage() {
    return `'use client';

import type { JSX } from 'react';

import { App } from '@/components/App';

export function ClientOnly(): JSX.Element {
    return <App />;
}
`;
}

function nextPage() {
    return `import type { JSX } from 'react';

import { ClientOnly } from './client';

export function generateStaticParams() {
    return [{ slug: [''] }];
}

export default function HomePage(): JSX.Element {
    return <ClientOnly />;
}
`;
}

function nextGlobalCss() {
    return `@import '../constants/color.css';
@import '../constants/font.css';

/* Keep global.css for resets, tokens, and app shell. Put component CSS next to
   its component, like components/Nav.tsx with components/Nav.css. */

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html {
    background-color: var(--clr-bg);
    color: var(--clr-text);
}

body {
    min-width: 320px;
    min-height: 100vh;
    font: var(--font-body-md);
    line-height: 1.5;
    background-color: var(--clr-bg);
}

a {
    color: inherit;
}

:focus-visible {
    outline: calc(var(--space-16) / 8) solid var(--clr-accent);
    outline-offset: calc(var(--space-16) / 8);
}

.app {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: var(--space-32) var(--space-24);
}

.app__content {
    display: grid;
    justify-items: center;
    gap: var(--space-16);
    width: fit-content;
    max-width: 100%;
    text-align: center;
}

.app__eyebrow {
    color: var(--clr-text-muted);
    font: var(--font-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.app__title {
    font: var(--font-display);
}

.app__description {
    color: var(--clr-text-muted);
}
`;
}

function packageManagerDeclaration() {
    switch (selectedPackageManager) {
        case 'bun':
            return 'bun@1.3.9';
        case 'npm':
            return 'npm@11';
        case 'pnpm':
            return 'pnpm@10';
        case 'yarn':
            return 'yarn@4';
        default:
            fail(`Unsupported package manager: ${selectedPackageManager}`);
    }
}

function installCommand() {
    switch (selectedPackageManager) {
        case 'bun':
            return 'bun install';
        case 'npm':
            return 'npm install';
        case 'pnpm':
            return 'pnpm install';
        case 'yarn':
            return 'yarn install';
        default:
            fail(`Unsupported package manager: ${selectedPackageManager}`);
    }
}

function devCommand() {
    switch (selectedPackageManager) {
        case 'yarn':
            return 'yarn dev';
        case 'bun':
        case 'npm':
        case 'pnpm':
            return `${selectedPackageManager} run dev`;
        default:
            fail(`Unsupported package manager: ${selectedPackageManager}`);
    }
}

function checkCommand() {
    switch (selectedPackageManager) {
        case 'yarn':
            return 'yarn check';
        case 'bun':
        case 'npm':
        case 'pnpm':
            return `${selectedPackageManager} run check`;
        default:
            fail(`Unsupported package manager: ${selectedPackageManager}`);
    }
}

function securityNoteForPackageManager() {
    switch (selectedPackageManager) {
        case 'bun':
            return 'This project includes `bunfig.toml` with `minimumReleaseAge = 604800`.';
        case 'npm':
            return 'This project includes `.npmrc` with `min-release-age=7`.';
        case 'pnpm':
            return 'This project includes `pnpm-workspace.yaml` with `minimumReleaseAge: 10080`.';
        case 'yarn':
            return 'This project includes `.yarnrc.yml` with `npmMinimalAgeGate: 7d`.';
        default:
            fail(`Unsupported package manager: ${selectedPackageManager}`);
    }
}

function packageManagerConfigFile() {
    switch (selectedPackageManager) {
        case 'bun':
            return 'bunfig.toml';
        case 'npm':
            return '.npmrc';
        case 'pnpm':
            return 'pnpm-workspace.yaml';
        case 'yarn':
            return '.yarnrc.yml';
        default:
            fail(`Unsupported package manager: ${selectedPackageManager}`);
    }
}
