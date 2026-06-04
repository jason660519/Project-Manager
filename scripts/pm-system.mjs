#!/usr/bin/env node

import {
  PM_SYSTEM_COMMANDS,
  INSTALL_ACTIONS,
  DRY_RUN_INSTALL_MESSAGE,
  backupSteps,
} from '../infra/supabase/pm-system-plans.mjs';
import { collectInstallerPreflight } from '../infra/supabase/pm-system-preflight.mjs';

const command = process.argv[2] ?? 'status';
const flags = new Set(process.argv.slice(3));

const knownCommands = new Set(PM_SYSTEM_COMMANDS);

if (!knownCommands.has(command)) {
  console.error(`Unknown PM System command: ${command}`);
  console.error(`Supported commands: ${PM_SYSTEM_COMMANDS.join(', ')}`);
  process.exit(2);
}

if (!flags.has('--dry-run')) {
  console.error('PM System CLI currently supports dry-run planning only. Re-run with --dry-run.');
  process.exit(2);
}

const response = await buildDryRunResponse(command, flags);
console.log(response.title);
for (const line of response.lines) {
  console.log(line);
}

process.exit(response.blocked ? 1 : 0);

async function buildDryRunResponse(commandName, commandFlags) {
  switch (commandName) {
    case 'install': {
      const preflightLines = commandFlags.has('--skip-preflight')
        ? ['Preflight skipped by --skip-preflight.']
        : await buildPreflightLines();
      return {
        blocked: preflightLines.some((line) => line.startsWith('BLOCKED')),
        title: 'PM System install plan: dry_run',
        lines: [
          DRY_RUN_INSTALL_MESSAGE,
          ...preflightLines,
          ...INSTALL_ACTIONS.map((action) => `- ${action}`),
        ],
      };
    }
    case 'doctor': {
      const preflightLines = commandFlags.has('--skip-preflight')
        ? ['Preflight skipped by --skip-preflight.']
        : await buildPreflightLines();
      return {
        blocked: preflightLines.some((line) => line.startsWith('BLOCKED')),
        title: 'PM System doctor plan: dry_run',
        lines: [
          'Dry run only. Doctor will check runtime, ports, Auth, Postgres, migrations, Storage, Realtime, and connector state when live checks are enabled.',
          ...preflightLines,
        ],
      };
    }
    case 'backup': {
      // Step list is sourced from the shared planner, not hardcoded, so the CLI
      // can never drift from planBackup(). `--no-storage` mirrors the planner's
      // includeStorage flag instead of unconditionally exporting storage.
      const includeStorage = !commandFlags.has('--no-storage');
      return {
        blocked: false,
        title: 'PM System backup plan: dry_run',
        lines: backupSteps(includeStorage).map((step) => `- ${step}`),
      };
    }
    case 'restore':
      return {
        blocked: true,
        title: 'PM System restore plan: dry_run',
        lines: [
          'Restore is blocked in this wrapper until a backup source and explicit confirmation flow are implemented.',
        ],
      };
    case 'upgrade':
      return {
        blocked: true,
        title: 'PM System upgrade plan: dry_run',
        lines: [
          'Upgrade is blocked in this wrapper until verified backup and doctor status inputs are implemented.',
        ],
      };
    default:
      return {
        blocked: false,
        title: `PM System ${commandName} plan: dry_run`,
        lines: [
          'Dry run only. Live service control is not implemented in this wrapper.',
        ],
      };
  }
}

async function buildPreflightLines() {
  const preflight = await collectInstallerPreflight({ dryRun: true });
  const lines = [];

  if (preflight.runtime) {
    lines.push(`PASS runtime: ${preflight.runtime.kind} ${preflight.runtime.version}`);
  } else {
    lines.push('BLOCKED runtime: no Docker-compatible runtime detected');
  }

  for (const port of preflight.ports) {
    lines.push(
      `${port.available ? 'PASS' : 'BLOCKED'} port ${port.port}: ${port.service}`,
    );
  }

  return lines;
}
