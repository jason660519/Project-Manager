#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function rel(file) {
  return path.relative(root, file);
}

function walk(dir, visit) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git' || entry === 'generated') continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, visit);
    } else {
      visit(full);
    }
  }
}

function read(file) {
  return readFileSync(file, 'utf8');
}

function fail(message) {
  failures.push(message);
}

const forbiddenPaths = [
  'app/coding-editor',
  'app/ui/views/MonacoEditorWorkbench.tsx',
  'app/ui/views/ProjectFilesView.tsx',
  'components/CodeEditor.tsx',
];

for (const forbidden of forbiddenPaths) {
  if (existsSync(path.join(root, forbidden))) {
    fail(`legacy Coding Editor path exists: ${forbidden}`);
  }
}

const activeSourceDirs = ['app', 'components', 'lib'];
const forbiddenSourcePatterns = [
  {
    pattern: /\bcoding-editor\b/i,
    reason: 'legacy /coding-editor route or link',
  },
  {
    pattern: /\bCoding Editor\b/,
    reason: 'legacy Coding Editor UI label',
    allow: (file, content) =>
      file.includes(path.join('lib', 'integrations')) &&
      content.includes('Coding Editor/Orchestrator'),
  },
  {
    pattern: /currentView=["']coding-editor["']|['"]coding-editor['"]\s*\|/,
    reason: 'legacy ViewId wiring',
  },
];

for (const dir of activeSourceDirs) {
  walk(path.join(root, dir), (file) => {
    if (!/\.(ts|tsx|js|jsx|md)$/.test(file)) return;
    const content = read(file);
    for (const rule of forbiddenSourcePatterns) {
      if (rule.pattern.test(content) && !rule.allow?.(file, content)) {
        fail(`${rule.reason}: ${rel(file)}`);
      }
    }
  });
}

const sidebar = path.join(root, 'app/ui/Sidebar.tsx');
if (existsSync(sidebar)) {
  const content = read(sidebar);
  if (!content.includes("href: '/xmux'") || !content.includes("id: 'xmux'")) {
    fail('Sidebar must route the current workspace entry to /xmux with ViewId xmux.');
  }
  if (content.includes("href: '/coding-editor'") || content.includes('Coding Editor')) {
    fail('Sidebar still exposes the retired Coding Editor entry.');
  }
  if (content.includes("href: '/cmux'") || content.includes("id: 'cmux'")) {
    fail('Sidebar must not expose /cmux as the primary workspace entry.');
  }
}

const xmuxRoute = path.join(root, 'app/xmux/page.tsx');
if (!existsSync(xmuxRoute)) {
  fail('Current xmux route missing: app/xmux/page.tsx');
} else {
  const content = read(xmuxRoute);
  if (!content.includes('MainClient') || !content.includes('currentView="xmux"')) {
    fail('Current /xmux route must render MainClient with ViewId xmux.');
  }
}

const legacyCmuxRoute = path.join(root, 'app/cmux/page.tsx');
if (existsSync(legacyCmuxRoute)) {
  const content = read(legacyCmuxRoute);
  if (!content.includes("redirect('/xmux')")) {
    fail('Legacy /cmux route must redirect to /xmux, not render a separate surface.');
  }
}

const sheetTabs = path.join(root, 'app/project-progress-dashboard/_components/SheetTabs.tsx');
if (existsSync(sheetTabs)) {
  const content = read(sheetTabs);
  const requiredTokens = [
    'DASHBOARD_SHEET_ORDER_STORAGE_KEY',
    'normalizeSheetOrder',
    'onPointerDown',
    'onPointerEnter',
    'GripVertical',
  ];
  for (const token of requiredTokens) {
    if (!content.includes(token)) {
      fail(`Project dashboard SheetTabs lost draggable sheet support: missing ${token}`);
    }
  }
} else {
  fail('Project dashboard SheetTabs component missing.');
}

if (failures.length > 0) {
  console.error('Legacy surface guard failed:');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Legacy surface guard passed.');
