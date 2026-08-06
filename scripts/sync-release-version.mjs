import { readFileSync, writeFileSync } from 'node:fs';

const rootPackageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const version = rootPackageJson.version;
const packagePath = 'packages/create-hsi-app/package.json';
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
packageJson.version = version;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 4)}\n`);

const scriptPath = 'packages/create-hsi-app/bin/create-hsi-app.mjs';
const source = readFileSync(scriptPath, 'utf8');
const templateTagPattern = /const templateTag = 'v\d+\.\d+\.\d+';/;

if (!templateTagPattern.test(source)) {
    throw new Error('templateTag not found');
}

const nextSource = source.replace(
    templateTagPattern,
    `const templateTag = 'v${version}';`
);
writeFileSync(scriptPath, nextSource);
