import { execFileSync } from 'node:child_process';
import net from 'node:net';

export const DEFAULT_PREFLIGHT_TIMEOUT_MS = 2500;

export function defaultCommandRunner(command, args, options = {}) {
  try {
    const stdout = execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeoutMs ?? DEFAULT_PREFLIGHT_TIMEOUT_MS,
    });
    return {
      ok: true,
      stdout: stdout.trim(),
      stderr: '',
    };
  } catch (error) {
    return {
      ok: false,
      stdout: typeof error?.stdout === 'string' ? error.stdout.trim() : '',
      stderr: typeof error?.stderr === 'string' ? error.stderr.trim() : String(error?.message ?? error),
    };
  }
}

export function detectDockerRuntime(options = {}) {
  const runCommand = options.runCommand ?? defaultCommandRunner;

  const docker = runCommand('docker', ['version', '--format', '{{.Server.Version}}']);
  if (docker.ok) {
    return {
      kind: 'docker-compatible',
      version: docker.stdout || 'unknown',
    };
  }

  const podman = runCommand('podman', ['version', '--format', '{{.Version}}']);
  if (podman.ok) {
    return {
      kind: 'podman',
      version: podman.stdout || 'unknown',
    };
  }

  return null;
}

export function defaultIsPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export async function checkPortAvailability(portChecks, options = {}) {
  const isPortAvailable = options.isPortAvailable ?? defaultIsPortAvailable;
  const host = options.host ?? '127.0.0.1';

  return Promise.all(
    portChecks.map(async (check) => ({
      ...check,
      available: await isPortAvailable(check.port, host),
    })),
  );
}

export async function collectInstallerPreflight(options = {}) {
  const getRequiredPortChecks =
    options.getRequiredPortChecks ??
    (() => [
      { port: 8000, available: true, service: 'Supabase API gateway' },
      { port: 5432, available: true, service: 'Postgres' },
      { port: 54323, available: true, service: 'Supabase Studio' },
    ]);

  const runtime = detectDockerRuntime({ runCommand: options.runCommand });
  const ports = await checkPortAvailability(getRequiredPortChecks(), {
    isPortAvailable: options.isPortAvailable,
    host: options.host,
  });

  return {
    runtime,
    ports,
    dryRun: Boolean(options.dryRun),
  };
}
