export type PmBackendDeploymentMode = 'local-self-hosted' | 'vm-self-hosted' | 'supabase-cloud';

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
  dryRun?: boolean;
}

export type InstallerPlanStatus =
  | 'ready_to_install'
  | 'runtime_required'
  | 'port_conflict'
  | 'existing_stack'
  | 'dry_run';

export type InstallerPlanAction =
  | 'guide-runtime-install'
  | 'resolve-port-conflicts'
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

const INSTALL_ACTIONS: InstallerPlanAction[] = [
  'generate-local-secrets',
  'write-ops-env',
  'pull-supabase-images',
  'start-supabase-stack',
  'run-pm-migrations',
  'create-owner-account',
  'write-backend-profile',
  'run-health-checks',
];

export const PM_SYSTEM_COMMANDS: readonly PmSystemCommand[] = [
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
      messages: ['Dry run only. No Docker, filesystem, network, or secret mutation will be performed.'],
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
