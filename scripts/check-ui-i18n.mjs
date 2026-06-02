#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cjkPattern = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const sourceExtensions = new Set(['.ts', '.tsx']);
const allowLineMarker = 'i18n-allow-cjk';

const scanFiles = [
  'app/ui/views/Keys/KeysProviderTable.tsx',
];

const scanRoots = [
  'components/ui',
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function isSource(filePath) {
  return sourceExtensions.has(path.extname(filePath));
}

const files = Array.from(
  new Set([
    ...scanFiles.map((filePath) => path.join(root, filePath)),
    ...scanRoots.flatMap((scanRoot) => walk(path.join(root, scanRoot))).filter(isSource),
  ]),
).filter((filePath) => fs.existsSync(filePath));

const hits = [];

for (const filePath of files) {
  const relPath = path.relative(root, filePath);
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!cjkPattern.test(line)) return;
    if (line.includes(allowLineMarker)) return;
    hits.push({ relPath, line: index + 1, text: line.trim() });
  });
}

if (hits.length > 0) {
  console.error('[P1] UI source contains hard-coded CJK text in guarded surfaces.');
  console.error('Move visible copy to lib/i18n/*, or add an explicit i18n-allow-cjk marker for approved test/domain content.');
  for (const hit of hits) {
    console.error(`${hit.relPath}:${hit.line}: ${hit.text}`);
  }
  process.exit(1);
}

console.log(`UI i18n check passed (${files.length} files scanned).`);
