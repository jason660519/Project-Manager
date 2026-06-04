#!/usr/bin/env node

const command = process.argv[2] ?? 'status';
const flags = new Set(process.argv.slice(3));

const knownCommands = new Set([
  'install',
  'start',
  'stop',
  'status',
  'doctor',
  'backup',
  'restore',
  'upgrade',
  'logs',
]);

if (!knownCommands.has(command)) {
  console.error(`Unknown PM System command: ${command}`);
  console.error('Supported commands: install, start, stop, status, doctor, backup, restore, upgrade, logs');
  process.exit(2);
}

if (!flags.has('--dry-run')) {
  console.error('PM System CLI currently supports dry-run planning only. Re-run with --dry-run.');
  process.exit(2);
}

const response = buildDryRunResponse(command);
console.log(response.title);
for (const line of response.lines) {
  console.log(line);
}

process.exit(response.blocked ? 1 : 0);

function buildDryRunResponse(commandName) {
  switch (commandName) {
    case 'install':
      return {
        blocked: false,
        title: 'PM System install plan: dry_run',
        lines: [
          'Dry run only. No Docker, filesystem, network, or secret mutation will be performed.',
          '- generate-local-secrets',
          '- write-ops-env',
          '- pull-supabase-images',
          '- start-supabase-stack',
          '- run-pm-migrations',
          '- create-owner-account',
          '- write-backend-profile',
          '- run-health-checks',
        ],
      };
    case 'doctor':
      return {
        blocked: false,
        title: 'PM System doctor plan: dry_run',
        lines: [
          'Dry run only. Doctor will check runtime, ports, Auth, Postgres, migrations, Storage, Realtime, and connector state when live checks are enabled.',
        ],
      };
    case 'backup':
      return {
        blocked: false,
        title: 'PM System backup plan: dry_run',
        lines: [
          '- export-postgres',
          '- export-storage-artifacts',
          '- write-backup-manifest',
          '- verify-backup-manifest',
        ],
      };
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
