#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const configPath = path.join(repoRoot, '.project-manager', 'config.json');

const VALID_STATUSES = new Set(['todo', 'in_progress', 'done', 'on_hold']);
const VALID_PHASES = new Set(['development', 'e2e_testing', 'deployment', 'operations']);

function printHelp() {
  process.stdout.write(`Project Manager feature checkpoint scaffold

Usage:
  npm run feature:kickoff -- --title "Feature Title" [options]
  npm run feature:kickoff -- --id F36 --title "Updated Title" [options]

Options:
  --title <value>             Feature title. Required for new features.
  --id <Fxx>                  Update a specific feature ID.
  --category <value>          Defaults to Frontend/UI.
  --phase <value>             Defaults to development.
  --status <value>            Defaults to in_progress.
  --progress <0-100>          Defaults to 10 for new features.
  --points <number>           Defaults to 3.
  --located-section <path>    Dashboard location.
  --implementation <path>     Primary implementation path.
  --test <path>               Focused test path.
  --notes <value>             Short dashboard notes.
  --updated-by <value>        Defaults to Codex.
  --dry-run                   Print planned changes without writing files.
  --force                     Overwrite existing generated artifact files.
  --help                      Show this help.
`);
}

function parseArgs(argv) {
  const out = {
    updatedBy: 'Codex',
    dryRun: false,
    force: false,
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
    if (arg === '--force') {
      out.force = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      if (!out.title) out.title = arg;
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
      case 'title':
        out.title = value;
        break;
      case 'id':
        out.id = value.toUpperCase();
        break;
      case 'category':
        out.category = value;
        break;
      case 'phase':
        out.phase = value;
        break;
      case 'status':
        out.status = value;
        break;
      case 'progress':
        out.progress = value;
        break;
      case 'points':
        out.points = value;
        break;
      case 'located-section':
        out.locatedSection = value;
        break;
      case 'implementation':
        out.implementation = value;
        break;
      case 'test':
        out.test = value;
        break;
      case 'notes':
        out.notes = value;
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

function readConfig() {
  if (!existsSync(configPath)) {
    throw new Error(`Missing config: ${path.relative(repoRoot, configPath)}`);
  }
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function parseFeatureNumber(id) {
  const match = /^F(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

function nextFeatureId(features) {
  const max = features.reduce((currentMax, feature) => {
    const value = parseFeatureNumber(feature.id);
    return value === null ? currentMax : Math.max(currentMax, value);
  }, 0);
  return `F${String(max + 1).padStart(2, '0')}`;
}

function asInteger(name, raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer: ${raw}`);
  return value;
}

function validateOptions(options, isNew) {
  if (options.id && !/^F\d+$/.test(options.id)) {
    throw new Error(`Feature ID must look like F36: ${options.id}`);
  }
  if (isNew && !options.title) {
    throw new Error('New features require --title "Feature Title"');
  }
  if (options.status && !VALID_STATUSES.has(options.status)) {
    throw new Error(`Invalid --status ${options.status}; expected one of ${[...VALID_STATUSES].join(', ')}`);
  }
  if (options.phase && !VALID_PHASES.has(options.phase)) {
    throw new Error(`Invalid --phase ${options.phase}; expected one of ${[...VALID_PHASES].join(', ')}`);
  }
}

function featureFolderFor(id) {
  return `.project-manager/features/${id}/`;
}

function artifactPathsFor(id) {
  const folder = featureFolderFor(id);
  return {
    featureFolder: folder,
    readme: `${folder}README.md`,
    spec: `${folder}feature-spec.md`,
    tdd: `${folder}tdd-spec.md`,
    testScenarios: `${folder}test-scenarios.md`,
    devLog: `${folder}dev-log.md`,
  };
}

function titleFor(options, existingFeature, id) {
  return options.title ?? existingFeature?.name ?? `${id} Feature Checkpoint`;
}

function todayDate(now) {
  return now.toISOString().slice(0, 10);
}

function templateReadme({ id, title, status, progress, phase, category, now }) {
  return `# ${id} - ${title}

## Summary

Describe the feature goal, user value, and implementation boundary before changing code.

## Current State

- Status: ${status}
- Progress: ${progress}%
- Phase: ${phase}
- Category: ${category}
- Owner: Codex
- Created: ${todayDate(now)}

## Scope

- Define the first implementation slice.
- Keep changes scoped to the feature boundary.
- Add or update focused tests before broad refactors.
- Record verification evidence in \`dev-log.md\`.

## Non-Goals

- Broad unrelated cleanup.
- Schema changes unless explicitly required.
- Secret or credential storage.

## Artifacts

- Feature spec: \`feature-spec.md\`
- TDD spec: \`tdd-spec.md\`
- User scenarios: \`test-scenarios.md\`
- Dev log: \`dev-log.md\`
`;
}

function templateFeatureSpec({ id, title }) {
  return `# ${id}: ${title}

## Purpose

Explain what this feature changes, who benefits, and why this work should happen now.

## Background

Summarize the local evidence, existing implementation shape, and constraints discovered before implementation.

## User Stories

| ID | Story |
| --- | --- |
| US-01 | As a user, I want the primary workflow to remain clear so that I can complete the task without guessing state. |
| US-02 | As a maintainer, I want the implementation boundary documented so that follow-up work does not drift. |

## Functional Requirements

- Register the work in Development Progress on the Project Progress Dashboard.
- Preserve existing app shell, navigation, and status visibility.
- Keep fallback, loading, empty, error, and blocked states explicit where applicable.

## Technical Requirements

- Reuse existing repo patterns and helpers.
- Keep new files under the established feature folder and implementation path.
- Add focused tests for user-visible behavior and regression risks.
- Do not store secrets, credentials, or private transcripts in artifacts.

## Acceptance Criteria

1. ${id} appears in Development Progress on the Project Progress Dashboard with canonical artifact paths.
2. Feature artifacts are complete enough for a future engineer to continue.
3. Focused tests or explicit manual checks cover the core user paths.
4. Verification commands and results are recorded in \`dev-log.md\`.

## Open Decisions

- Add implementation-specific decisions here before coding if scope is still ambiguous.
`;
}

function templateTddSpec({ id }) {
  return `# ${id} TDD Specification

## Suite A: Metadata and artifacts

| Case | Input | Expected |
| --- | --- | --- |
| A1 | \`.project-manager/config.json\` | ${id} exists with phase \`development\` unless intentionally changed |
| A2 | Feature paths | README, spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard notes | \`feature.notes\` is short text, not an artifact path |

## Suite B: Core behavior

| Case | User action | Expected |
| --- | --- | --- |
| B1 | User opens the affected route or workflow | Existing state and navigation remain visible |
| B2 | User hits an empty/loading/error state | The state is explicit and recoverable |
| B3 | User repeats the core workflow | No duplicate side effects or stale UI state |

## Suite C: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| C1 | Existing routes or sheets regress | Focused tests or manual smoke cover affected routes |
| C2 | Dirty worktree has unrelated changes | Implementation avoids overwriting unrelated files |
| C3 | Verification is skipped | Dev log says which checks were skipped and why |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| ${id}-M01 | Primary workflow smoke | Open the affected route or workflow | It renders without blank state or hidden failure |
| ${id}-M02 | Recovery state | Trigger or inspect a fallback state | The UI explains what happened and what to do next |

## Required Verification

- Focused tests for changed behavior.
- \`npm run typecheck\` when TypeScript changes.
- \`npm run docs:check\` when docs or feature artifacts change.
`;
}

function templateTestScenarios({ id }) {
  return `# ${id} Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| ${id}-S01 | User opens the affected route or workflow | Blank shell, hidden error, or stale state | Add focused render or behavior test | Browser smoke for affected route | Candidate | Kickoff |
| ${id}-S02 | User repeats the main action | Duplicate write or stale UI | Add regression test around state update | Manual repeat-action smoke | Candidate | Kickoff |
| ${id}-S03 | User encounters missing data or permissions | UI implies success when blocked | Add empty/error-state test | Manual blocked-state smoke | Candidate | Kickoff |

## Unit Test Backlog

- Add focused tests once implementation files are known.

## E2E Candidate Backlog

- Add browser/Tauri smoke for the primary user path if the feature touches navigation, xmux, dispatch, keys, or file-system behavior.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
`;
}

function templateDevLog({ id, title, now }) {
  return `# ${id} Dev Log - ${title}

## ${todayDate(now)} - Kickoff

### Context

Feature checkpoint created before implementation so Development Progress, specs, tests, and dev logs stay aligned on the Project Progress Dashboard.

### Planned Work

1. Confirm the feature boundary and affected files.
2. Implement the smallest safe slice.
3. Add or update focused tests for user-visible behavior.
4. Run relevant verification commands.
5. Record results and follow-ups here.

### Design Decision

Use a feature-local checkpoint before code changes. This keeps dashboard metadata, specs, TDD scenarios, and implementation evidence in one durable place.

### Verification Log

- Pending: focused tests.
- Pending: \`npm run typecheck\` if TypeScript changes.
- Pending: \`npm run docs:check\`.
`;
}

function writeArtifact(relativePath, content, options, writes) {
  const absolutePath = path.join(repoRoot, relativePath);
  const existed = existsSync(absolutePath);
  if (existed && !options.force) {
    writes.push({ path: relativePath, action: 'kept' });
    return;
  }
  writes.push({ path: relativePath, action: existed ? 'overwritten' : 'created', content });
}

function applyWrites(writes, options) {
  if (options.dryRun) return;
  for (const write of writes) {
    if (!write.content) continue;
    const absolutePath = path.join(repoRoot, write.path);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, write.content);
  }
}

function buildFeature({ id, title, options, existingFeature, now, artifacts }) {
  const progress = asInteger('progress', options.progress, existingFeature?.progress ?? 10);
  if (progress < 0 || progress > 100) throw new Error(`progress must be 0-100: ${progress}`);
  const points = asInteger('points', options.points, existingFeature?.points ?? 3);
  const category = options.category ?? existingFeature?.category ?? 'Frontend/UI';
  const status = options.status ?? existingFeature?.status ?? 'in_progress';
  const phase = options.phase ?? existingFeature?.phase ?? 'development';
  const implementation = options.implementation ?? existingFeature?.paths?.implementation ?? artifacts.featureFolder;
  const test = options.test ?? existingFeature?.paths?.test ?? '';
  const locatedSection =
    options.locatedSection ?? existingFeature?.locatedSection ?? implementation ?? artifacts.featureFolder;

  return {
    ...(existingFeature ?? {}),
    id,
    name: title,
    category,
    status,
    progress,
    phase,
    points,
    locatedSection,
    readmePath: artifacts.readme,
    paths: {
      ...(existingFeature?.paths ?? {}),
      featureFolder: artifacts.featureFolder,
      spec: artifacts.spec,
      tdd: artifacts.tdd,
      testScenarios: artifacts.testScenarios,
      developmentLogSummaryFolder: artifacts.featureFolder,
      implementation,
      ...(test ? { test } : {}),
    },
    notes:
      options.notes ??
      existingFeature?.notes ??
      'Feature checkpoint created before implementation; specs, TDD scenarios, and dev log are registered for continuation.',
    createdAt: existingFeature?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    updatedBy: options.updatedBy,
    metadata: {
      ...(existingFeature?.metadata ?? {}),
      evidencePaths: [
        implementation,
        ...(test ? [test] : []),
        artifacts.devLog,
      ].filter(Boolean),
      kickoffAt: existingFeature?.metadata?.kickoffAt ?? now.toISOString(),
    },
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const config = readConfig();
  const features = Array.isArray(config.features) ? config.features : [];
  const id = options.id ?? nextFeatureId(features);
  const existingIndex = features.findIndex((feature) => feature.id === id);
  const existingFeature = existingIndex >= 0 ? features[existingIndex] : null;
  validateOptions(options, !existingFeature);

  const now = new Date();
  const title = titleFor(options, existingFeature, id);
  const artifacts = artifactPathsFor(id);
  const feature = buildFeature({ id, title, options, existingFeature, now, artifacts });

  const writes = [];
  writeArtifact(
    artifacts.readme,
    templateReadme({
      id,
      title,
      status: feature.status,
      progress: feature.progress,
      phase: feature.phase,
      category: feature.category,
      now,
    }),
    options,
    writes,
  );
  writeArtifact(artifacts.spec, templateFeatureSpec({ id, title }), options, writes);
  writeArtifact(artifacts.tdd, templateTddSpec({ id }), options, writes);
  writeArtifact(artifacts.testScenarios, templateTestScenarios({ id }), options, writes);
  writeArtifact(artifacts.devLog, templateDevLog({ id, title, now }), options, writes);

  if (existingIndex >= 0) {
    features[existingIndex] = feature;
  } else {
    features.push(feature);
  }
  config.features = features;
  config.updatedAt = now.toISOString();
  config.updatedBy = options.updatedBy;

  const configWrite = {
    path: '.project-manager/config.json',
    action: existingFeature ? 'updated' : 'created-feature',
    content: `${JSON.stringify(config, null, 2)}\n`,
  };
  writes.push(configWrite);

  if (!options.dryRun) {
    applyWrites(writes, options);
  }

  const result = {
    dryRun: options.dryRun,
    feature: {
      id: feature.id,
      name: feature.name,
      status: feature.status,
      progress: feature.progress,
      phase: feature.phase,
      readmePath: feature.readmePath,
      paths: feature.paths,
    },
    writes: writes.map(({ path: writePath, action }) => ({ path: writePath, action })),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
