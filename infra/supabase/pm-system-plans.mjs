// Canonical PM System plan definitions.
//
// Single source of truth for the dry-run step lists, shared by BOTH:
//   - the typed installer module  (infra/supabase/pm-system-installer.ts)
//   - the runtime CLI wrapper     (scripts/pm-system.mjs)
//
// The CLI cannot import the TypeScript module directly (node runs .mjs, not
// .ts), so prior to this both hardcoded the same step lists and could silently
// drift. Keep this file dependency-free and side-effect-free; types live in the
// co-located pm-system-plans.d.mts so the .ts module stays strictly typed.

export const PM_SYSTEM_COMMANDS = [
  'install',
  'start',
  'stop',
  'status',
  'doctor',
  'backup',
  'restore',
  'upgrade',
  'logs',
];

export const INSTALL_ACTIONS = [
  'generate-local-secrets',
  'write-ops-env',
  'pull-supabase-images',
  'start-supabase-stack',
  'run-pm-migrations',
  'create-owner-account',
  'write-backend-profile',
  'run-health-checks',
];

export const DRY_RUN_INSTALL_MESSAGE =
  'Dry run only. No Docker, filesystem, network, or secret mutation will be performed.';

export function backupSteps(includeStorage) {
  return [
    'export-postgres',
    ...(includeStorage ? ['export-storage-artifacts'] : []),
    'write-backup-manifest',
    'verify-backup-manifest',
  ];
}

export const RESTORE_STEPS = [
  'stop-supabase-stack',
  'restore-postgres',
  'restore-storage-artifacts',
  'run-health-checks',
  'write-restore-audit-event',
];

export const UPGRADE_STEPS = [
  'pull-target-images',
  'stop-supabase-stack',
  'start-supabase-stack',
  'run-pm-migrations',
  'run-health-checks',
  'write-upgrade-audit-event',
];
