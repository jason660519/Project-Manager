#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const configPath = path.join(repoRoot, '.project-manager', 'config.json');

const VALID_STATUSES = new Set(['todo', 'in_progress', 'done', 'on_hold']);
const VALID_PHASES = new Set(['development', 'e2e_testing', 'deployment', 'operations']);

function printHelp() {
  process.stdout.write(`Project Manager feature resume

Usage:
  npm run feature:resume -- --id F36 [options]
  npm run feature:resume -- F36 --plan "Continue xmux profiling"

Options:
  --id <Fxx>              Existing feature ID to resume.
  --progress <0-100>      Optional progress update.
  --status <value>        Optional status update.
  --phase <value>         Optional phase update.
  --notes <value>         Optional short dashboard notes.
  --plan <value>          Optional continuation plan for dev-log.md.
  --updated-by <value>    Defaults to Codex.
  --dry-run               Print planned changes without writing files.
  --no-devlog             Do not append dev-log; metadata update only.
  --help                  Show this help.
`);
}

function parseArgs(argv) {
  const out = {
    updatedBy: 'Codex',
    dryRun: false,
    noDevlog: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (arg === '--no-devlog') {
      out.noDevlog = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      if (!out.id) out.id = arg.toUpperCase();
      else throw new Error(`Unexpected positional argument: ${arg}`);
      continue;
    }

    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;

    switch (key) {
      case 'id':
        out.id = value.toUpperCase();
        break;
      case 'progress':
        out.progress = value;
        break;
      case 'status':
        out.status = value;
        break;
      case 'phase':
        out.phase = value;
        break;
      case 'notes':
        out.notes = value;
        break;
      case 'plan':
        out.plan = value;
        break;
      case 'updated-by':
        out.updatedBy = value;
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }

  return out;
}

function readJsonConfig() {
  if (!existsSync(configPath)) {
    throw new Error(`Missing config: ${path.relative(repoRoot, configPath)}`);
  }
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function validateOptions(options) {
  if (!options.id) throw new Error('Feature resume requires --id Fxx or positional Fxx');
  if (!/^F\d+$/.test(options.id)) throw new Error(`Feature ID must look like F36: ${options.id}`);
  if (options.status && !VALID_STATUSES.has(options.status)) {
    throw new Error(`Invalid --status ${options.status}; expected one of ${[...VALID_STATUSES].join(', ')}`);
  }
  if (options.phase && !VALID_PHASES.has(options.phase)) {
    throw new Error(`Invalid --phase ${options.phase}; expected one of ${[...VALID_PHASES].join(', ')}`);
  }
}

function asInteger(name, raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer: ${raw}`);
  return value;
}

function pathExists(relativePath) {
  return Boolean(relativePath) && existsSync(path.join(repoRoot, relativePath));
}

function artifactPaths(feature) {
  const folder = feature.paths?.featureFolder ?? `.project-manager/features/${feature.id}/`;
  return {
    folder,
    readme: feature.readmePath ?? `${folder}README.md`,
    spec: feature.paths?.spec ?? `${folder}feature-spec.md`,
    tdd: feature.paths?.tdd ?? `${folder}tdd-spec.md`,
    testScenarios: feature.paths?.testScenarios ?? `${folder}test-scenarios.md`,
    devLog: `${feature.paths?.developmentLogSummaryFolder ?? folder}dev-log.md`,
  };
}

function readArtifactSummary(paths) {
  return Object.fromEntries(
    Object.entries(paths).map(([key, value]) => [
      key,
      {
        path: value,
        exists: key === 'folder' ? pathExists(value) : pathExists(value),
      },
    ]),
  );
}

function todayDate(now) {
  return now.toISOString().slice(0, 10);
}

function continuationBlock({ feature, options, now, paths }) {
  const plan = options.plan
    ? `- ${options.plan}`
    : [
        '- Review the feature spec, TDD spec, test scenarios, and previous dev-log entries.',
        '- Confirm the next smallest implementation slice before editing code.',
        '- Add or update focused tests for any resumed behavior.',
      ].join('\n');

  return `
## ${todayDate(now)} - Continuation

### Context

Resuming ${feature.id} - ${feature.name}. This continuation starts from the registered Development-sheet feature artifacts instead of creating a new feature ID.

### Previous State

- Status: ${feature.status}
- Progress: ${feature.progress ?? 0}%
- Phase: ${feature.phase ?? 'development'}
- Implementation: ${feature.paths?.implementation ?? '(not set)'}
- Focused test: ${feature.paths?.test ?? '(not set)'}

### Artifacts Reviewed

- README: ${paths.readme}
- Feature spec: ${paths.spec}
- TDD spec: ${paths.tdd}
- Test scenarios: ${paths.testScenarios}
- Dev log: ${paths.devLog}

### Planned Work

${plan}

### Verification Log

- Pending: focused tests for resumed behavior.
- Pending: npm run typecheck if TypeScript changes.
- Pending: npm run docs:check if artifacts change.
`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  validateOptions(options);

  const config = readJsonConfig();
  const features = Array.isArray(config.features) ? config.features : [];
  const featureIndex = features.findIndex((feature) => feature.id === options.id);
  if (featureIndex === -1) {
    throw new Error(`Feature not found in .project-manager/config.json: ${options.id}`);
  }

  const now = new Date();
  const feature = { ...features[featureIndex] };
  const paths = artifactPaths(feature);
  const artifacts = readArtifactSummary(paths);
  const missing = Object.values(artifacts)
    .filter((artifact) => artifact.path && !artifact.exists)
    .map((artifact) => artifact.path);
  if (missing.length > 0) {
    throw new Error(`Missing feature artifacts for ${feature.id}:\n- ${missing.join('\n- ')}`);
  }

  const progress = asInteger('progress', options.progress, feature.progress ?? 0);
  if (progress < 0 || progress > 100) throw new Error(`progress must be 0-100: ${progress}`);

  feature.progress = progress;
  feature.status = options.status ?? feature.status ?? 'in_progress';
  feature.phase = options.phase ?? feature.phase ?? 'development';
  feature.notes = options.notes ?? feature.notes;
  feature.updatedAt = now.toISOString();
  feature.updatedBy = options.updatedBy;
  feature.metadata = {
    ...(feature.metadata ?? {}),
    resumedAt: now.toISOString(),
  };

  const writes = [];
  if (!options.noDevlog) {
    const devLogPath = path.join(repoRoot, paths.devLog);
    const existing = readFileSync(devLogPath, 'utf8');
    const next = `${existing.trimEnd()}\n${continuationBlock({ feature, options, now, paths })}`;
    writes.push({ path: paths.devLog, action: 'appended', content: next });
  }

  features[featureIndex] = feature;
  config.features = features;
  config.updatedAt = now.toISOString();
  config.updatedBy = options.updatedBy;
  writes.push({
    path: '.project-manager/config.json',
    action: 'updated',
    content: `${JSON.stringify(config, null, 2)}\n`,
  });

  if (!options.dryRun) {
    for (const write of writes) {
      writeFileSync(path.join(repoRoot, write.path), write.content);
    }
  }

  process.stdout.write(`${JSON.stringify({
    dryRun: options.dryRun,
    feature: {
      id: feature.id,
      name: feature.name,
      status: feature.status,
      progress: feature.progress,
      phase: feature.phase,
      notes: feature.notes,
      paths,
    },
    artifacts,
    writes: writes.map(({ path: writePath, action }) => ({ path: writePath, action })),
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
