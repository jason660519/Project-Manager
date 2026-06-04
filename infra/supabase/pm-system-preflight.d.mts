import type { DockerRuntimeInfo, InstallerPreflight, PortCheck } from './pm-system-installer';

export const DEFAULT_PREFLIGHT_TIMEOUT_MS: number;

export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options?: { timeoutMs?: number },
) => CommandResult;

export function defaultCommandRunner(
  command: string,
  args: string[],
  options?: { timeoutMs?: number },
): CommandResult;

export function detectDockerRuntime(options?: {
  runCommand?: CommandRunner;
}): DockerRuntimeInfo | null;

export function defaultIsPortAvailable(port: number, host?: string): Promise<boolean>;

export function checkPortAvailability(
  portChecks: PortCheck[],
  options?: {
    isPortAvailable?: (port: number, host?: string) => Promise<boolean> | boolean;
    host?: string;
  },
): Promise<PortCheck[]>;

export function collectInstallerPreflight(options?: {
  runCommand?: CommandRunner;
  isPortAvailable?: (port: number, host?: string) => Promise<boolean> | boolean;
  getRequiredPortChecks?: () => PortCheck[];
  host?: string;
  dryRun?: boolean;
}): Promise<InstallerPreflight>;
