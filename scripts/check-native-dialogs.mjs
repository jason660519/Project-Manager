#!/usr/bin/env node
/**
 * Guard against native browser dialogs in client UI.
 *
 * In Tauri, `window.confirm` / `window.alert` / `window.prompt` can route
 * through dialog plugin commands that may not be allowed by capabilities.
 * Project Manager UI should use in-app React modals/panels instead. The
 * allowlist below tracks legacy debt by exact line text so new usages fail
 * verify:baseline immediately.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SEARCH_ROOTS = ['app', 'components'];
const EXTENSIONS = new Set(['.ts', '.tsx']);
const NATIVE_DIALOG_RE = /\bwindow\.(confirm|alert|prompt)\s*\(/;

const ALLOWED_LINES = new Set([
  "const raw = window.prompt('Resize column width in px. Enter 0 to hide this column.', String(header.column.getSize()));",
  "const raw = window.prompt('Resize column width in px. Enter 0 to hide this column.', String(columnWidths[column.id] ?? column.width));",
  "const raw = window.prompt('Resize column width in px. Enter 0 to hide this column.', String(prefs.colWidths[originalIndex] ?? 120));",
  "const raw = window.prompt('Resize row height in px. Enter 0 to hide rows individually from row menu.', String(prefs.rowHeight));",
  "if (typeof window !== 'undefined') window.alert(t.settingsView.presetCopied);",
  "if (typeof window !== 'undefined') window.prompt(t.settingsView.copyPresetPrompt, json);",
  "const input = window.prompt(t.settingsView.importPresetPrompt, '[]');",
  "window.alert(err instanceof Error ? err.message : t.settingsView.importPresetInvalid);",
  "const merge = window.confirm(copy.importMergePrompt);",
  "if (typeof window !== 'undefined' && !window.confirm(`Delete channel \"${target.label}\"?`)) return;",
  "if (typeof window !== 'undefined' && !window.confirm('Clear this channel\\'s activity log?')) return;",
  "if (typeof window !== 'undefined' && !window.confirm(`Delete command \"${target.trigger}\"?`)) return;",
  "if (typeof window !== 'undefined' && !window.confirm(t.plugins.deleteSkillConfirm.replace('{path}', path))) return;",
  "const input = window.prompt(",
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'out') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

const violations = [];

for (const root of SEARCH_ROOTS) {
  const absRoot = path.join(ROOT, root);
  if (!fs.existsSync(absRoot)) continue;
  for (const file of walk(absRoot)) {
    const rel = path.relative(ROOT, file);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!NATIVE_DIALOG_RE.test(line)) return;
      const trimmed = line.trim();
      if (ALLOWED_LINES.has(trimmed)) return;
      violations.push(`${rel}:${index + 1}: ${trimmed}`);
    });
  }
}

if (violations.length > 0) {
  console.error('Native browser dialog guard failed.');
  console.error('Use an in-app React confirmation/modal instead of window.confirm/alert/prompt.');
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Native browser dialog guard passed.');
