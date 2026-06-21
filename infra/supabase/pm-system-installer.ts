import {
  backupSteps,
  DRY_RUN_INSTALL_MESSAGE,
  INSTALL_ACTIONS,
  PM_SYSTEM_COMMANDS,
  RESTORE_STEPS,
  UPGRADE_STEPS,
} from './pm-system-plans.mjs';

export { PM_SYSTEM_COMMANDS };

export type PmBackendDeploymentMode =
  | 'local-docker-supabase'
  | 'self-hosted-supabase'
  | 'supabase-cloud';

export type DockerRuntimeKind = 'docker-desktop' | 'orbstack' | 'rancher-desktop' | 'podman' | 'docker-compatible';

export interface DockerRuntimeInfo {
  kind: DockerRuntimeKind;
  version: string;
  socketPath?: string;
}

export interface PortCheck {
  port: number;
  available: boolean;
  service: string;
}

export interface ExistingStackInfo {
  installed: boolean;
  schemaVersion?: number;
  profileId?: string;
  volumesDetected?: boolean;
}

export interface InstallerPreflight {
  runtime: DockerRuntimeInfo | null;
  ports: PortCheck[];
  existingStack?: ExistingStackInfo;
  kongRoutes?: {
    valid: boolean;
    missingRoutes: string[];
  };
  dryRun?: boolean;
}

export type InstallerPlanStatus =
  | 'ready_to_install'
  | 'runtime_required'
  | 'port_conflict'
  | 'service_checks_required'
  | 'route_required'
  | 'existing_stack'
  | 'dry_run';

export type InstallerPlanAction =
  | 'guide-runtime-install'
  | 'resolve-port-conflicts'
  | 'validate-kong-routes'
  | 'inspect-existing-stack'
  | 'generate-local-secrets'
  | 'write-ops-env'
  | 'pull-supabase-images'
  | 'start-supabase-stack'
  | 'run-pm-migrations'
  | 'create-owner-account'
  | 'write-backend-profile'
  | 'run-health-checks';

export interface InstallerPlan {
  status: InstallerPlanStatus;
  actions: InstallerPlanAction[];
  blocked: boolean;
  messages: string[];
}

export interface BackendProfileInput {
  id: string;
  label: string;
  mode: PmBackendDeploymentMode;
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey?: string;
  databasePassword?: string;
}

export interface RendererSafeBackendProfile {
  id: string;
  label: string;
  mode: PmBackendDeploymentMode;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface PmBackendPorts {
  api: number;
  postgres: number;
  studio: number;
  storage: number;
  realtime: number;
}

export interface PmBackendSecrets {
  supabaseAnonKey: string;
  serviceRoleKey: string;
  jwtSecret: string;
  databasePassword: string;
}

export interface PmBackendProfilePairInput {
  id: string;
  label: string;
  mode: Exclude<PmBackendDeploymentMode, 'supabase-cloud'>;
  host: string;
  ports: PmBackendPorts;
  secrets: PmBackendSecrets;
  composeProjectName: string;
  schemaVersion: number;
}

export interface OpsOnlyBackendProfile extends RendererSafeBackendProfile {
  serviceRoleKey: string;
  jwtSecret: string;
  databasePassword: string;
  ports: PmBackendPorts;
  composeProjectName: string;
  schemaVersion: number;
}

export interface PmBackendProfilePair {
  renderer: RendererSafeBackendProfile;
  ops: OpsOnlyBackendProfile;
}

export type PmSystemCommand =
  | 'install'
  | 'start'
  | 'stop'
  | 'status'
  | 'doctor'
  | 'backup'
  | 'restore'
  | 'upgrade'
  | 'logs';

export interface MaintenancePolicy {
  command: PmSystemCommand;
  requiresBackup: boolean;
  requiresConfirmation: boolean;
  mutatesData: boolean;
}

export type DoctorCheckId =
  | 'runtime'
  | 'ports'
  | 'kong-routes'
  | 'auth'
  | 'rest'
  | 'postgres'
  | 'migrations'
  | 'storage'
  | 'realtime'
  | 'connector';

export type DoctorCheckStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
  id: DoctorCheckId;
  status: DoctorCheckStatus;
  message: string;
  recovery?: string;
}

export interface DoctorReport {
  status: 'healthy' | 'degraded' | 'failed';
  checks: DoctorCheck[];
  summary: string;
}

export interface BackupPlanInput {
  destination: string;
  includeStorage: boolean;
  retentionDays: number;
}

export interface BackupPlan {
  destination: string;
  steps: string[];
  retentionDays: number;
  safeToRun: boolean;
}

export interface RestorePlanInput {
  backupSource: string | null;
  confirmationPhrase?: string;
}

export interface RestorePlan {
  blocked: boolean;
  steps: string[];
  message: string;
}

export interface UpgradePlanInput {
  targetVersion: string;
  backupVerified: boolean;
  doctorStatus: DoctorReport['status'];
}

export interface UpgradePlan {
  blocked: boolean;
  steps: string[];
  message: string;
}

export interface ScaffoldFile {
  path: string;
  purpose: string;
}

export interface ScaffoldAudit {
  safe: boolean;
  findings: string[];
}

export interface PmSystemCliRequest {
  command: PmSystemCommand;
  dryRun?: boolean;
  preflight?: InstallerPreflight;
  backup?: BackupPlanInput;
  restore?: RestorePlanInput;
  upgrade?: UpgradePlanInput;
}

export interface PmSystemCliResponse {
  command: PmSystemCommand;
  blocked: boolean;
  title: string;
  lines: string[];
}

export const DEFAULT_PM_BACKEND_PORTS: PmBackendPorts = {
  api: 8000,
  postgres: 5432,
  studio: 54323,
  storage: 5000,
  realtime: 4000,
};

export const PM_SUPABASE_SCAFFOLD_FILES: readonly ScaffoldFile[] = [
  {
    path: 'infra/supabase/docker-compose.pm-system.yml',
    purpose: 'Self-hosted Supabase compose scaffold for PM backend services.',
  },
  {
    path: 'infra/supabase/pm-system.env.example',
    purpose: 'Example environment contract with placeholders only.',
  },
  {
    path: 'infra/supabase/migrations/0001_pm_core.sql',
    purpose: 'Initial PM workspace/auth schema migration scaffold.',
  },
  {
    path: 'infra/supabase/migrations/0002_features_audit_logs.sql',
    purpose: 'Cloud feature metadata and workspace-scoped audit_logs with RLS.',
  },
  {
    path: 'infra/supabase/migrations/0003_runner_devices.sql',
    purpose: 'Developer Runner pairing metadata with developer-scoped RLS.',
  },
  {
    path: 'infra/supabase/migrations/0004_agent_runs_runner_device_fk.sql',
    purpose: 'Canonical agent_runs.runner_device_id FK with same-workspace trigger guard.',
  },
  {
    path: 'infra/supabase/migrations/0005_report_metadata.sql',
    purpose: 'User Portal report index metadata with published-vs-draft RLS.',
  },
  {
    path: 'infra/supabase/migrations/0006_sync_cursors.sql',
    purpose: 'Local/cloud sync cursor bookkeeping for future writeback.',
  },
  {
    path: 'infra/supabase/seed.sql',
    purpose: 'Development-only seed placeholder without real users or secrets.',
  },
  {
    path: 'infra/supabase/templates/kong.yml',
    purpose: 'Kong declarative config placeholder for self-hosted API gateway routing.',
  },
];

export function getRequiredPortChecks(
  ports: PmBackendPorts = DEFAULT_PM_BACKEND_PORTS,
): PortCheck[] {
  return [
    { port: ports.api, available: true, service: 'Supabase API gateway' },
    { port: ports.postgres, available: true, service: 'Postgres' },
    { port: ports.studio, available: true, service: 'Supabase Studio' },
    { port: 9999, available: true, service: 'Supabase Auth' },
    { port: 3000, available: true, service: 'PostgREST' },
    { port: ports.storage, available: true, service: 'Supabase Storage' },
    { port: ports.realtime, available: true, service: 'Supabase Realtime' },
  ];
}

function missingRequiredServiceChecks(ports: PortCheck[]): string[] {
  const checkedServices = new Set(ports.map((port) => port.service));
  return getRequiredPortChecks()
    .map((port) => port.service)
    .filter((service) => !checkedServices.has(service));
}

export function planPmSystemInstall(preflight: InstallerPreflight): InstallerPlan {
  if (!preflight.runtime) {
    return {
      status: 'runtime_required',
      actions: ['guide-runtime-install'],
      blocked: true,
      messages: [
        'A Docker-compatible runtime is required before Project Manager can install the self-hosted backend.',
      ],
    };
  }

  const conflictedPorts = preflight.ports.filter((port) => !port.available);
  if (conflictedPorts.length > 0) {
    return {
      status: 'port_conflict',
      actions: ['resolve-port-conflicts'],
      blocked: true,
      messages: conflictedPorts.map(
        (port) => `Port ${port.port} is already in use; required for ${port.service}.`,
      ),
    };
  }

  const missingServices = missingRequiredServiceChecks(preflight.ports);
  if (missingServices.length > 0) {
    return {
      status: 'service_checks_required',
      actions: ['run-health-checks'],
      blocked: true,
      messages: [
        `Install preflight did not check required services: ${missingServices.join(', ')}.`,
      ],
    };
  }

  if (!preflight.kongRoutes?.valid) {
    return {
      status: 'route_required',
      actions: ['validate-kong-routes'],
      blocked: true,
      messages: [
        preflight.kongRoutes
          ? `Kong routes missing: ${preflight.kongRoutes.missingRoutes.join(', ')}.`
          : 'Kong route validation is required before install can proceed.',
      ],
    };
  }

  if (preflight.existingStack?.installed) {
    return {
      status: 'existing_stack',
      actions: ['inspect-existing-stack', 'run-health-checks'],
      blocked: false,
      messages: [
        'An existing PM backend stack was detected. Use status, doctor, backup, or upgrade instead of reinstalling over existing volumes.',
      ],
    };
  }

  if (preflight.dryRun) {
    return {
      status: 'dry_run',
      actions: [...INSTALL_ACTIONS],
      blocked: false,
      messages: [DRY_RUN_INSTALL_MESSAGE],
    };
  }

  return {
    status: 'ready_to_install',
    actions: [...INSTALL_ACTIONS],
    blocked: false,
    messages: ['Host preflight passed. PM backend install can proceed with explicit owner approval.'],
  };
}

export function toRendererSafeBackendProfile(
  input: BackendProfileInput,
): RendererSafeBackendProfile {
  return {
    id: input.id,
    label: input.label,
    mode: input.mode,
    supabaseUrl: input.supabaseUrl,
    supabaseAnonKey: input.supabaseAnonKey,
  };
}

export function createPmBackendProfilePair(
  input: PmBackendProfilePairInput,
): PmBackendProfilePair {
  if (!/^https?:\/\//i.test(input.host)) {
    // The field is named `host`, which invites bare values like "localhost".
    // Building `${host}:${port}` from a scheme-less host yields an invalid URL
    // (e.g. "localhost:8000") that fetch/WebView cannot resolve. Fail loudly
    // instead of writing a broken supabaseUrl into the renderer profile.
    throw new Error(
      `PM backend host must include an http(s):// scheme; received "${input.host}".`,
    );
  }
  const supabaseUrl = `${input.host.replace(/\/+$/, '')}:${input.ports.api}`;
  const renderer = toRendererSafeBackendProfile({
    id: input.id,
    label: input.label,
    mode: input.mode,
    supabaseUrl,
    supabaseAnonKey: input.secrets.supabaseAnonKey,
  });

  return {
    renderer,
    ops: {
      ...renderer,
      serviceRoleKey: input.secrets.serviceRoleKey,
      jwtSecret: input.secrets.jwtSecret,
      databasePassword: input.secrets.databasePassword,
      ports: input.ports,
      composeProjectName: input.composeProjectName,
      schemaVersion: input.schemaVersion,
    },
  };
}

export function renderOpsEnv(profile: OpsOnlyBackendProfile): string {
  const rows: Array<[string, string | number]> = [
    ['PM_BACKEND_PROFILE_ID', profile.id],
    ['PM_BACKEND_MODE', profile.mode],
    ['PM_BACKEND_SUPABASE_URL', profile.supabaseUrl],
    ['PM_BACKEND_SUPABASE_ANON_KEY', profile.supabaseAnonKey],
    ['PM_BACKEND_SUPABASE_SERVICE_ROLE_KEY', profile.serviceRoleKey],
    ['PM_BACKEND_JWT_SECRET', profile.jwtSecret],
    ['PM_BACKEND_DATABASE_PASSWORD', profile.databasePassword],
    ['PM_BACKEND_COMPOSE_PROJECT_NAME', profile.composeProjectName],
    ['PM_BACKEND_SCHEMA_VERSION', profile.schemaVersion],
    ['PM_BACKEND_API_PORT', profile.ports.api],
    ['PM_BACKEND_POSTGRES_PORT', profile.ports.postgres],
    ['PM_BACKEND_STUDIO_PORT', profile.ports.studio],
    ['PM_BACKEND_STORAGE_PORT', profile.ports.storage],
    ['PM_BACKEND_REALTIME_PORT', profile.ports.realtime],
  ];

  return `${rows.map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

export function renderRedactedOpsEnv(profile: OpsOnlyBackendProfile): string {
  return renderOpsEnv({
    ...profile,
    serviceRoleKey: '[redacted]',
    jwtSecret: '[redacted]',
    databasePassword: '[redacted]',
  });
}

export function getMaintenancePolicy(command: PmSystemCommand): MaintenancePolicy {
  switch (command) {
    case 'backup':
      return {
        command,
        requiresBackup: false,
        requiresConfirmation: false,
        mutatesData: false,
      };
    case 'restore':
      return {
        command,
        requiresBackup: false,
        requiresConfirmation: true,
        mutatesData: true,
      };
    case 'upgrade':
      return {
        command,
        requiresBackup: true,
        requiresConfirmation: true,
        mutatesData: true,
      };
    case 'install':
    case 'start':
    case 'stop':
      return {
        command,
        requiresBackup: false,
        requiresConfirmation: true,
        mutatesData: false,
      };
    case 'status':
    case 'doctor':
    case 'logs':
      return {
        command,
        requiresBackup: false,
        requiresConfirmation: false,
        mutatesData: false,
      };
  }
}

export function buildDoctorReport(checks: DoctorCheck[]): DoctorReport {
  const hasFailure = checks.some((check) => check.status === 'fail');
  const hasWarning = checks.some((check) => check.status === 'warn');

  if (hasFailure) {
    return {
      status: 'failed',
      checks,
      summary: 'PM backend doctor found blocking failures. Do not start, upgrade, or dispatch until these are resolved.',
    };
  }

  if (hasWarning) {
    return {
      status: 'degraded',
      checks,
      summary: 'PM backend doctor found degraded checks. Core access may work, but follow recovery guidance before shipping or upgrading.',
    };
  }

  return {
    status: 'healthy',
    checks,
    summary: 'PM backend doctor checks passed.',
  };
}

export function getBlockingDoctorChecks(report: DoctorReport): DoctorCheck[] {
  return report.checks.filter((check) => check.status === 'fail');
}

export function getRecoveryActions(report: DoctorReport): string[] {
  return report.checks.flatMap((check) => (check.recovery ? [check.recovery] : []));
}

export function planBackup({
  destination,
  includeStorage,
  retentionDays,
}: BackupPlanInput): BackupPlan {
  return {
    destination,
    steps: backupSteps(includeStorage),
    retentionDays,
    safeToRun: destination.trim().length > 0 && retentionDays > 0,
  };
}

export function planRestore({
  backupSource,
  confirmationPhrase,
}: RestorePlanInput): RestorePlan {
  if (!backupSource) {
    return {
      blocked: true,
      steps: [],
      message: 'Restore requires a known backup source.',
    };
  }

  if (confirmationPhrase !== 'RESTORE PM BACKEND') {
    return {
      blocked: true,
      steps: [],
      message: 'Restore requires explicit confirmation phrase: RESTORE PM BACKEND.',
    };
  }

  return {
    blocked: false,
    steps: [...RESTORE_STEPS],
    message: 'Restore can proceed with explicit confirmation.',
  };
}

export function planUpgrade({
  targetVersion,
  backupVerified,
  doctorStatus,
}: UpgradePlanInput): UpgradePlan {
  if (!backupVerified) {
    return {
      blocked: true,
      steps: ['run-backup-first'],
      message: 'Upgrade requires a verified backup before pulling images or running migrations.',
    };
  }

  if (doctorStatus === 'failed') {
    return {
      blocked: true,
      steps: ['resolve-doctor-failures'],
      message: 'Upgrade is blocked while backend doctor reports failures.',
    };
  }

  return {
    blocked: false,
    steps: [...UPGRADE_STEPS],
    message: `Upgrade to ${targetVersion} can proceed.`,
  };
}

export function auditScaffoldContent(files: Array<{ path: string; content: string }>): ScaffoldAudit {
  const suspiciousPatterns = [
    /service[_-]?role[_-]?secret/i,
    /db[_-]?password/i,
    /jwt[_-]?secret/i,
    /sk-[A-Za-z0-9]/,
    /ghp_[A-Za-z0-9]/,
  ];
  const allowedPlaceholders = [
    'change-me-service-role-key',
    'change-me-database-password',
    'change-me-jwt-secret',
  ];

  // Scan line-by-line. A known placeholder only exempts the line it appears on,
  // not the whole file — otherwise a single `change-me-*` placeholder would
  // silently disable secret detection for every other line, which defeats the
  // entire purpose of this guard (a real secret pasted next to a placeholder
  // would pass).
  const findings = files.flatMap((file) =>
    file.content.split('\n').flatMap((line, index) => {
      if (allowedPlaceholders.some((placeholder) => line.includes(placeholder))) {
        return [];
      }
      return suspiciousPatterns
        .filter((pattern) => pattern.test(line))
        .map(
          (pattern) =>
            `${file.path}:${index + 1} contains suspicious secret-like content: ${pattern.source}`,
        );
    }),
  );

  return {
    safe: findings.length === 0,
    findings,
  };
}

function buildPortsDoctorCheck(ports: PortCheck[] | undefined): DoctorCheck {
  const portList = ports ?? [];
  // No port data is NOT a pass. Reporting "pass" when nothing was checked is a
  // false success, which the runbook explicitly forbids — surface it as a
  // warning so the overall doctor status is at most `degraded`, never healthy.
  if (portList.length === 0) {
    return {
      id: 'ports',
      status: 'warn',
      message: 'No port preflight data was provided; required ports were not verified.',
      recovery: 'Run a port preflight (getRequiredPortChecks) before trusting doctor output.',
    };
  }

  const conflicted = portList.filter((port) => !port.available);
  if (conflicted.length > 0) {
    return {
      id: 'ports',
      status: 'fail',
      message: `Required ports unavailable: ${conflicted.map((port) => port.port).join(', ')}.`,
      recovery: 'Free the conflicting ports or change the PM backend port profile.',
    };
  }

  return {
    id: 'ports',
    status: 'pass',
    message: 'Required port preflight completed.',
  };
}

function buildServicePortDoctorCheck(
  id: DoctorCheckId,
  ports: PortCheck[] | undefined,
  serviceName: string,
): DoctorCheck {
  const servicePort = ports?.find((port) => port.service === serviceName);
  if (!servicePort) {
    return {
      id,
      status: 'warn',
      message: `${serviceName} port was not checked.`,
      recovery: `Run preflight with the complete local Docker Supabase port contract before trusting ${id} readiness.`,
    };
  }

  if (!servicePort.available) {
    return {
      id,
      status: 'fail',
      message: `${serviceName} port ${servicePort.port} is unavailable.`,
      recovery: `Free port ${servicePort.port} or change the PM backend ${id} port profile.`,
    };
  }

  return {
    id,
    status: 'pass',
    message: `${serviceName} port ${servicePort.port} is available for dry-run readiness.`,
  };
}

function buildKongRoutesDoctorCheck(kongRoutes: InstallerPreflight['kongRoutes']): DoctorCheck {
  if (!kongRoutes) {
    return {
      id: 'kong-routes',
      status: 'warn',
      message: 'Kong route validation was not provided.',
      recovery: 'Validate infra/supabase/templates/kong.yml before live local Docker use.',
    };
  }

  if (!kongRoutes.valid) {
    return {
      id: 'kong-routes',
      status: 'fail',
      message: `Kong routes missing: ${kongRoutes.missingRoutes.join(', ')}.`,
      recovery: 'Add the missing Auth, REST, Storage, and Realtime Kong routes.',
    };
  }

  return {
    id: 'kong-routes',
    status: 'pass',
    message: 'Kong routes cover Auth, REST, Storage, and Realtime.',
  };
}

export function buildPmSystemCliResponse(request: PmSystemCliRequest): PmSystemCliResponse {
  switch (request.command) {
    case 'install': {
      const plan = planPmSystemInstall({
        runtime: null,
        ports: getRequiredPortChecks(),
        ...request.preflight,
        dryRun: request.dryRun ?? request.preflight?.dryRun,
      });
      return {
        command: 'install',
        blocked: plan.blocked,
        title: `PM System install plan: ${plan.status}`,
        lines: [
          ...plan.messages,
          ...plan.actions.map((action) => `- ${action}`),
        ],
      };
    }
    case 'doctor': {
      const report = buildDoctorReport([
        {
          id: 'runtime',
          status: request.preflight?.runtime ? 'pass' : 'fail',
          message: request.preflight?.runtime
            ? `Runtime detected: ${request.preflight.runtime.kind} ${request.preflight.runtime.version}`
            : 'No Docker-compatible runtime detected.',
          recovery: request.preflight?.runtime
            ? undefined
            : 'Install or start a Docker-compatible runtime, then run doctor again.',
        },
        buildPortsDoctorCheck(request.preflight?.ports),
        buildKongRoutesDoctorCheck(request.preflight?.kongRoutes),
        buildServicePortDoctorCheck('auth', request.preflight?.ports, 'Supabase Auth'),
        buildServicePortDoctorCheck('rest', request.preflight?.ports, 'PostgREST'),
        buildServicePortDoctorCheck('postgres', request.preflight?.ports, 'Postgres'),
        buildServicePortDoctorCheck('storage', request.preflight?.ports, 'Supabase Storage'),
        buildServicePortDoctorCheck('realtime', request.preflight?.ports, 'Supabase Realtime'),
        {
          id: 'migrations',
          status: 'warn',
          message: 'Existing-volume migration runner is planned but not executed by dry-run doctor.',
          recovery: 'Run the migrations profile only after backup and owner approval.',
        },
        {
          id: 'connector',
          status: 'pass',
          message: 'Dry-run doctor keeps connector validation side-effect-free.',
        },
      ]);
      return {
        command: 'doctor',
        blocked: report.status === 'failed',
        title: `PM System doctor: ${report.status}`,
        lines: [
          report.summary,
          ...report.checks.map((check) => `${check.status.toUpperCase()} ${check.id}: ${check.message}`),
          ...getRecoveryActions(report).map((action) => `Recovery: ${action}`),
        ],
      };
    }
    case 'backup': {
      const plan = planBackup(
        request.backup ?? {
          destination: '',
          includeStorage: true,
          retentionDays: 14,
        },
      );
      return {
        command: 'backup',
        blocked: !plan.safeToRun,
        title: 'PM System backup plan',
        lines: [
          `Destination: ${plan.destination || '(missing)'}`,
          `Retention days: ${plan.retentionDays}`,
          ...plan.steps.map((step) => `- ${step}`),
        ],
      };
    }
    case 'restore': {
      const plan = planRestore(request.restore ?? { backupSource: null });
      return {
        command: 'restore',
        blocked: plan.blocked,
        title: 'PM System restore plan',
        lines: [
          plan.message,
          ...plan.steps.map((step) => `- ${step}`),
        ],
      };
    }
    case 'upgrade': {
      const plan = planUpgrade(
        request.upgrade ?? {
          targetVersion: '(missing)',
          backupVerified: false,
          doctorStatus: 'failed',
        },
      );
      return {
        command: 'upgrade',
        blocked: plan.blocked,
        title: 'PM System upgrade plan',
        lines: [
          plan.message,
          ...plan.steps.map((step) => `- ${step}`),
        ],
      };
    }
    case 'start':
    case 'stop':
    case 'status':
    case 'logs': {
      const policy = getMaintenancePolicy(request.command);
      return {
        command: request.command,
        blocked: false,
        title: `PM System ${request.command} plan`,
        lines: [
          `Requires confirmation: ${policy.requiresConfirmation ? 'yes' : 'no'}`,
          `Mutates data: ${policy.mutatesData ? 'yes' : 'no'}`,
        ],
      };
    }
  }
}
