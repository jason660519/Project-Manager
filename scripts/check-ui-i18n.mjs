#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cjkPattern = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const sourceExtensions = new Set(['.ts', '.tsx']);
const scanRoots = ['app/ui/views/Keys'];
const allowLineMarker = 'i18n-allow-cjk';

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

function isArenaSource(filePath) {
  const ext = path.extname(filePath);
  return sourceExtensions.has(ext) && /Arena/.test(path.basename(filePath));
}

const files = scanRoots.flatMap((scanRoot) => walk(path.join(root, scanRoot))).filter(isArenaSource);
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
  console.error('[P1] Arena UI source contains hard-coded CJK text. Move visible copy to lib/i18n/*.');
  for (const hit of hits) {
    console.error(`${hit.relPath}:${hit.line}: ${hit.text}`);
  }
  process.exit(1);
}

console.log(`Arena UI i18n check passed (${files.length} files scanned).`);
