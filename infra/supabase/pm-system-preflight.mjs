import { execFileSync } from 'node:child_process';
import net from 'node:net';

export const DEFAULT_PREFLIGHT_TIMEOUT_MS = 2500;
export const REQUIRED_KONG_ROUTES = ['/auth/v1', '/rest/v1', '/storage/v1', '/realtime/v1'];

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
      { port: 9999, available: true, service: 'Supabase Auth' },
      { port: 3000, available: true, service: 'PostgREST' },
      { port: 5000, available: true, service: 'Supabase Storage' },
      { port: 4000, available: true, service: 'Supabase Realtime' },
    ]);

  const runtime = detectDockerRuntime({ runCommand: options.runCommand });
  const ports = await checkPortAvailability(getRequiredPortChecks(), {
    isPortAvailable: options.isPortAvailable,
    host: options.host,
  });
  const kongRoutes =
    typeof options.kongConfigText === 'string'
      ? validateKongRoutes(options.kongConfigText)
      : options.kongRoutes;

  return {
    runtime,
    ports,
    ...(kongRoutes ? { kongRoutes } : {}),
    dryRun: Boolean(options.dryRun),
  };
}

export function validateKongRoutes(kongConfigText, requiredRoutes = REQUIRED_KONG_ROUTES) {
  const missingRoutes = requiredRoutes.filter((route) => !kongConfigText.includes(route));

  return {
    valid: missingRoutes.length === 0,
    missingRoutes,
  };
}
