#!/usr/bin/env node
/**
 * Source-driven table/sheet inventory and baseline audit.
 *
 * This intentionally does not trust docs snapshots. It scans the current source
 * for table/sheet implementations and verifies the hard Basic Table Sheet
 * requirements that can be checked statically.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = ['app', 'components'];
const REPORT_PATH = 'docs/engineering/table-sheet-inventory.md';

const MODULE_RULES = [
  [/app\/project-progress-dashboard\//, 'Project Progress Dashboard'],
  [/app\/ui\/views\/KeysView\.tsx$/, 'Keys'],
  [/app\/ui\/views\/AiSdksView\.tsx$/, 'AI SDKs'],
  [/app\/ui\/views\/Keys\//, 'Keys'],
  [/app\/ui\/views\/AiSdks\//, 'AI SDKs'],
  [/app\/ui\/views\/Plugins\//, 'Integrations Hub'],
  [/app\/ui\/views\/EngineersView\.tsx$/, 'Engineers'],
  [/app\/ui\/views\/Engineers\//, 'Engineers'],
  [/app\/ui\/views\/XmuxView\.tsx$/, 'Workspace'],
  [/app\/ui\/views\/ProjectsView\.tsx$/, 'Projects'],
  [/app\/ui\/views\/SettingsView\.tsx$/, 'Settings'],
  [/app\/ui\/views\/KeyboardShortcutsView\.tsx$/, 'Settings'],
  [/app\/ai_assistants\//, 'AI Assistants'],
  [/components\/table\/datasheet\//, 'Shared table primitive'],
  [/components\/table\/TableCore\.tsx$/, 'Shared table primitive'],
  [/components\/table\//, 'Dispatch table controls'],
];

const CLASSIFICATION_RULES = [
  [/app\/project-progress-dashboard\/ProjectProgressClient\.tsx$/, 'sheet-wrapper'],
  [/app\/ui\/views\/KeysView\.tsx$/, 'sheet-wrapper'],
  [/app\/ui\/views\/AiSdksView\.tsx$/, 'sheet-wrapper'],
  [/app\/ui\/views\/Plugins\/PluginsHubView\.tsx$/, 'sheet-wrapper'],
  [/app\/ui\/views\/EngineersView\.tsx$/, 'sheet-wrapper'],
  [/app\/ui\/views\/XmuxView\.tsx$/, 'workspace-tabs'],
  [/app\/ai_assistants\/AIAssistantsConsoleClient\.tsx$/, 'sheet-wrapper'],
  [/app\/project-progress-dashboard\/_components\/SheetTabs\.tsx$/, 'sheet-tab-primitive'],
  [/components\/table\/datasheet\//, 'shared-primitive'],
  [/components\/table\/TableCore\.tsx$/, 'simple'],
  [/app\/project-progress-dashboard\/_components\/PhaseTable\.tsx$/, 'basic'],
  [/app\/project-progress-dashboard\/_components\/IssuesTab\.tsx$/, 'basic'],
  [/app\/ui\/views\/Keys\/LlmArenaDetailSheet\.tsx$/, 'read-only/detail'],
  [/app\/ui\/views\/Plugins\/CapabilitySheetView\.tsx$/, 'read-only/detail'],
  [/app\/ui\/views\/Plugins\/ConnectSheet\.tsx$/, 'read-only/detail'],
  [/app\/ui\/views\/SettingsView\.tsx$/, 'simple'],
  [/app\/ui\/views\/KeyboardShortcutsView\.tsx$/, 'read-only'],
  [/app\/ui\/views\/FeaturesView\.tsx$/, 'simple-wrapper'],
  [/app\/ui\/DashboardClient\.tsx$/, 'simple-wrapper'],
];

const BASIC_REQUIREMENTS = [
  ['col-id', /['"]col-id['"]|COL_ID_COLUMN_HEADER/],
  ['table search/filter state', /searchText|globalFilter|projectSearch|issueSearch|filteredRows|filter/i],
  ['freeze columns', /Freeze cols|frozenColumnIds|frozenDataColCount|freezeCols/i],
  ['resizable columns', /columnSizing|colWidths|resize/i],
  ['hidden columns recovery', /Hidden cols|hiddenColumn|columnVisibility/i],
  ['visible table scrollbar', /pm-scroll|DataTableShell/],
  ['empty or filtered-empty state', /No rows match|filteredEmpty|empty|noProviders|noProvidersMatch|copy\.empty/i],
];

const SHEET_WRAPPER_REQUIREMENTS = [
  ['WorkstationFrame page frame', /<WorkstationFrame\b/],
  ['bottomTabs slot', /bottomTabs\s*=/],
  ['bottom sheet tabs', /<BottomSheetTabs\b|<SheetTabs\b/],
  ['reorderable sheet tabs', /reorderable|<SheetTabs\b/],
  ['table-owned scrolling', /scrollChildren=\{false\}/],
];

function parseArgs(argv) {
  return {
    write: argv.includes('--write'),
    check: argv.includes('--check'),
    json: argv.includes('--json'),
    failOnWarnings: argv.includes('--fail-on-warnings'),
  };
}

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === 'out' || name.startsWith('.')) continue;
    const path = join(dir, name);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (stat.isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(path);
  }
  return acc;
}

function rel(path) {
  return relative(ROOT, path).replaceAll('\\', '/');
}

function moduleFor(path) {
  return MODULE_RULES.find(([pattern]) => pattern.test(path))?.[1] ?? 'Other';
}

function explicitClassification(content) {
  return content.match(/@table-classification:\s*([a-z-]+)/i)?.[1] ?? null;
}

function inferredClassification(path) {
  return CLASSIFICATION_RULES.find(([pattern]) => pattern.test(path))?.[1] ?? 'unclassified';
}

function hasTableSurface(path, content) {
  if (/useReactTable|DataTableShell|TableCore|<table\b/.test(content)) return true;
  return path.startsWith('app/') && /<WorkstationFrame\b|<BottomSheetTabs\b|<SheetTabs\b/.test(content);
}

function implementationKind(content) {
  const kinds = [];
  if (/<WorkstationFrame\b/.test(content)) kinds.push('WorkstationFrame');
  if (/<BottomSheetTabs\b|<SheetTabs\b/.test(content)) kinds.push('BottomSheetTabs');
  if (/useReactTable/.test(content)) kinds.push('TanStack');
  if (/DataTableShell/.test(content)) kinds.push('DataTableShell');
  if (/TableCore/.test(content)) kinds.push('TableCore');
  if (/<table\b/.test(content)) kinds.push('HTML table');
  return kinds.join(' + ') || 'sheet wrapper';
}

function routeHint(path) {
  if (path.includes('project-progress-dashboard')) return '/project-progress-dashboard';
  if (path.includes('/Keys/') || path.endsWith('KeysView.tsx')) return '/keys';
  if (path.includes('/AiSdks') || path.endsWith('AiSdksView.tsx')) return '/ai-sdks';
  if (path.includes('/Plugins/') || path.endsWith('PluginsView.tsx')) return '/integrations-hub/system_installed_apps';
  if (path.includes('/Engineers') || path.endsWith('EngineersView.tsx')) return '/engineers';
  if (path.endsWith('ProjectsView.tsx')) return '/project-progress-dashboard';
  if (path.endsWith('SettingsView.tsx') || path.endsWith('KeyboardShortcutsView.tsx')) return '/settings';
  if (path.includes('ai_assistants')) return '/ai_assistants';
  if (path.endsWith('FeaturesView.tsx') || path.endsWith('DashboardClient.tsx')) return '/features';
  return '';
}

function auditSurface(path, content) {
  const explicit = explicitClassification(content);
  const classification = explicit ?? inferredClassification(path);
  const findings = [];
  const warnings = [];

  if (!explicit && classification === 'unclassified') {
    warnings.push('No @table-classification comment or inference rule.');
  }

  if (classification === 'basic') {
    for (const [label, pattern] of BASIC_REQUIREMENTS) {
      if (!pattern.test(content)) findings.push(`Missing static signal: ${label}`);
    }
  }

  if (classification === 'sheet-wrapper') {
    for (const [label, pattern] of SHEET_WRAPPER_REQUIREMENTS) {
      if (!pattern.test(content)) findings.push(`Missing static signal: ${label}`);
    }
  }

  if ((classification === 'simple' || classification === 'read-only') && !/pm-scroll/.test(content)) {
    warnings.push('Simple/read-only table has no pm-scroll signal; verify overflow is impossible or handled by parent.');
  }

  return {
    path,
    module: moduleFor(path),
    route: routeHint(path),
    classification,
    source: explicit ? 'comment' : 'inferred',
    implementation: implementationKind(content),
    status: findings.length === 0 ? 'pass' : 'needs-work',
    findings,
    warnings,
  };
}

function markdownReport(surfaces) {
  const generatedAt = new Date().toISOString();
  const blocking = surfaces.flatMap((surface) =>
    surface.findings.map((finding) => `${surface.path}: ${finding}`),
  );
  const warnings = surfaces.flatMap((surface) =>
    surface.warnings.map((warning) => `${surface.path}: ${warning}`),
  );

  const lines = [
    '# Table Sheet Inventory',
    '',
    '> Status: Generated from current source',
    `> Generated at: ${generatedAt}`,
    '> Source command: `npm run table:sheet:audit -- --write`',
    '',
    'This report is source-driven. Do not use old hand-maintained coverage snapshots as completion proof.',
    '',
    '## Summary',
    '',
    `- Surfaces scanned: ${surfaces.length}`,
    `- Basic table sheets: ${surfaces.filter((s) => s.classification === 'basic').length}`,
    `- Blocking findings: ${blocking.length}`,
    `- Warnings: ${warnings.length}`,
    '',
    '## Inventory',
    '',
    '| Surface | Module | Route | Classification | Implementation | Status | Notes |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const surface of surfaces) {
    const notes = [...surface.findings, ...surface.warnings].join('; ') || 'Current static audit passed';
    lines.push(
      `| \`${surface.path}\` | ${surface.module} | ${surface.route || 'n/a'} | ${surface.classification} (${surface.source}) | ${surface.implementation} | ${surface.status} | ${notes} |`,
    );
  }

  lines.push('', '## Blocking Findings', '');
  if (blocking.length === 0) lines.push('None.');
  else for (const finding of blocking) lines.push(`- ${finding}`);

  lines.push('', '## Warnings', '');
  if (warnings.length === 0) lines.push('None.');
  else for (const warning of warnings) lines.push(`- ${warning}`);

  const routes = Array.from(new Set(surfaces.map((surface) => surface.route).filter(Boolean))).sort();
  lines.push(
    '',
    '## Static Test Report',
    '',
    `- Inventory source: ${surfaces.length} source-detected table/sheet surfaces under \`app/\` and \`components/\`.`,
    `- Basic sheet checks: ${BASIC_REQUIREMENTS.map(([label]) => label).join(', ')}.`,
    `- Sheet wrapper checks: ${SHEET_WRAPPER_REQUIREMENTS.map(([label]) => label).join(', ')}.`,
    `- Routes requiring UI smoke when changed: ${routes.join(', ')}.`,
  );

  lines.push(
    '',
    '## Required Dynamic Verification',
    '',
    'Static audit does not replace UI smoke. For changed table routes, run:',
    '',
    '```bash',
    'npm run verify:dev-issues -- --routes /changed-route[,/another-route]',
    'npm run verify:baseline',
    '```',
    '',
  );
  return lines.join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = SCAN_ROOTS.flatMap((root) => walk(join(ROOT, root)));
  const surfaces = files
    .map((file) => [rel(file), readFileSync(file, 'utf8')])
    .filter(([path, content]) => hasTableSurface(path, content))
    .filter(([path]) => !path.startsWith('lib/generated/'))
    .map(([path, content]) => auditSurface(path, content))
    .sort((a, b) => a.module.localeCompare(b.module) || a.path.localeCompare(b.path));

  const blocking = surfaces.flatMap((surface) => surface.findings);
  const warnings = surfaces.flatMap((surface) => surface.warnings);

  if (options.json) {
    console.log(JSON.stringify({ surfaces }, null, 2));
  } else if (options.check) {
    console.log(
      `[table:sheet:audit] Surfaces=${surfaces.length} Basic=${surfaces.filter((s) => s.classification === 'basic').length} Blocking=${blocking.length} Warnings=${warnings.length}`,
    );
    for (const surface of surfaces) {
      for (const finding of surface.findings) {
        console.error(`[FAIL] ${surface.path}: ${finding}`);
      }
    }
    if (options.failOnWarnings) {
      for (const surface of surfaces) {
        for (const warning of surface.warnings) {
          console.error(`[WARN] ${surface.path}: ${warning}`);
        }
      }
    }
  } else {
    const report = markdownReport(surfaces);
    if (options.write) {
      const target = join(ROOT, REPORT_PATH);
      if (!existsSync(dirname(target))) throw new Error(`Missing report directory: ${dirname(target)}`);
      writeFileSync(target, report);
      console.log(`[table:sheet:audit] Wrote ${REPORT_PATH}`);
    } else {
      console.log(report);
    }
  }

  if (blocking.length > 0 || (options.failOnWarnings && warnings.length > 0)) {
    process.exitCode = 1;
  }
}

main();
