#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const reportPath = path.join(repoRoot, 'docs', 'engineering', 'ui-components-report.md');
const includeRoots = [
  path.join(repoRoot, 'app', 'ui'),
  path.join(repoRoot, 'components'),
  path.join(repoRoot, 'app', 'project-progress-dashboard'),
];
const ignoreDirNames = new Set(['node_modules', '.next', 'out', 'dist', 'target', '.git']);

function toFileUrl(absolutePath) {
  const normalized = absolutePath.split(path.sep).join('/');
  return `file://${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

function walkDir(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirNames.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!fullPath.endsWith('.tsx')) continue;
    if (fullPath.includes(`${path.sep}__tests__${path.sep}`)) continue;
    out.push(fullPath);
  }
  return out;
}

function extractExportedNames(source) {
  const names = new Set();
  const patterns = [
    /\bexport\s+default\s+function\s+([A-Za-z0-9_]+)\b/g,
    /\bexport\s+function\s+([A-Za-z0-9_]+)\b/g,
    /\bexport\s+const\s+([A-Za-z0-9_]+)\b/g,
    /\bexport\s+default\s+([A-Za-z0-9_]+)\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const name = match[1];
      if (name) names.add(name);
    }
  }
  return [...names];
}

function componentLabel(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const exported = extractExportedNames(raw);
  if (exported.length > 0) return exported[0];
  const base = path.basename(filePath, path.extname(filePath));
  if (base === 'page') {
    const dir = path.basename(path.dirname(filePath));
    if (dir && dir !== 'app') return `${dir}Page`;
    return 'Page';
  }
  return base;
}

function isUiComponentName(name) {
  return /^[A-Z]/.test(name);
}

function categorize(filePath) {
  const rel = path.relative(repoRoot, filePath).split(path.sep).join('/');
  if (rel.startsWith('app/ui/views/')) return 'UI Views (app/ui/views)';
  if (rel.startsWith('app/project-progress-dashboard/')) return 'Project Progress Dashboard (app/project-progress-dashboard)';
  if (rel.startsWith('app/ui/')) return 'Shell & UI Frame (app/ui)';
  if (rel.startsWith('components/')) return 'Shared Components (components)';
  return 'Other';
}

function formatSection(title, items) {
  const lines = [`### ${title}`, ''];
  for (const item of items) {
    lines.push(`- [${item.name}](${toFileUrl(item.path)})`);
  }
  lines.push('');
  return lines.join('\n');
}

function buildGeneratedBlock() {
  const files = includeRoots
    .filter((p) => statSync(p, { throwIfNoEntry: false })?.isDirectory?.())
    .flatMap((p) => walkDir(p, []));

  const items = files
    .map((filePath) => {
      const name = componentLabel(filePath);
      return {
        path: filePath,
        rel: path.relative(repoRoot, filePath).split(path.sep).join('/'),
        name,
        category: categorize(filePath),
      };
    })
    .filter((item) => isUiComponentName(item.name))
    .sort((a, b) => (a.category + a.rel).localeCompare(b.category + b.rel));

  const groups = new Map();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }

  const now = new Date().toISOString();
  const header = [
    `自動生成時間：${now}`,
    `掃描範圍：${includeRoots.map((p) => path.relative(repoRoot, p)).join(', ')}`,
    `元件檔案數（.tsx）：${items.length}`,
    '',
  ].join('\n');

  const sections = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, categoryItems]) =>
      formatSection(
        category,
        categoryItems.sort((a, b) => (a.name + a.rel).localeCompare(b.name + b.rel)),
      ),
    )
    .join('\n');

  return `${header}${sections}`.trimEnd();
}

function replaceBetweenMarkers(raw, markerStart, markerEnd, replacement) {
  const startIndex = raw.indexOf(markerStart);
  const endIndex = raw.indexOf(markerEnd);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return `${raw.trimEnd()}\n\n${markerStart}\n${replacement}\n${markerEnd}\n`;
  }
  const before = raw.slice(0, startIndex + markerStart.length);
  const after = raw.slice(endIndex);
  return `${before}\n${replacement}\n${after}`;
}

const markerStart = '<!-- PM:UI_COMPONENTS:BEGIN -->';
const markerEnd = '<!-- PM:UI_COMPONENTS:END -->';
const existing = readFileSync(reportPath, 'utf8');
const generated = buildGeneratedBlock();
const updated = replaceBetweenMarkers(existing, markerStart, markerEnd, generated);
writeFileSync(reportPath, updated);
process.stdout.write(`Updated: ${reportPath}\n`);
