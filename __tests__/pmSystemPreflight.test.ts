import { describe, expect, it, vi } from 'vitest';
import {
  checkPortAvailability,
  collectInstallerPreflight,
  detectDockerRuntime,
} from '../infra/supabase/pm-system-preflight.mjs';

describe('PM System live-safe preflight', () => {
  it('detects Docker-compatible runtime from docker version', () => {
    const runCommand = vi.fn((command: string) => ({
      ok: command === 'docker',
      stdout: command === 'docker' ? '25.0.0' : '',
      stderr: '',
    }));

    expect(detectDockerRuntime({ runCommand })).toEqual({
      kind: 'docker-compatible',
      version: '25.0.0',
    });
    expect(runCommand).toHaveBeenCalledWith('docker', ['version', '--format', '{{.Server.Version}}']);
  });

  it('falls back to Podman when Docker is unavailable', () => {
    const runCommand = vi.fn((command: string) => ({
      ok: command === 'podman',
      stdout: command === 'podman' ? '5.0.0' : '',
      stderr: '',
    }));

    expect(detectDockerRuntime({ runCommand })).toEqual({
      kind: 'podman',
      version: '5.0.0',
    });
  });

  it('returns null when no supported runtime responds', () => {
    expect(
      detectDockerRuntime({
        runCommand: () => ({ ok: false, stdout: '', stderr: 'not found' }),
      }),
    ).toBeNull();
  });

  it('checks required port availability without mutating services', async () => {
    await expect(
      checkPortAvailability(
        [
          { port: 8000, available: true, service: 'Supabase API gateway' },
          { port: 5432, available: true, service: 'Postgres' },
        ],
        {
          isPortAvailable: (port) => port !== 5432,
        },
      ),
    ).resolves.toEqual([
      { port: 8000, available: true, service: 'Supabase API gateway' },
      { port: 5432, available: false, service: 'Postgres' },
    ]);
  });

  it('collects installer preflight with runtime and port checks', async () => {
    await expect(
      collectInstallerPreflight({
        dryRun: true,
        runCommand: (command) => ({
          ok: command === 'docker',
          stdout: command === 'docker' ? '25.0.0' : '',
          stderr: '',
        }),
        getRequiredPortChecks: () => [
          { port: 8000, available: true, service: 'Supabase API gateway' },
        ],
        isPortAvailable: () => true,
      }),
    ).resolves.toEqual({
      dryRun: true,
      runtime: {
        kind: 'docker-compatible',
        version: '25.0.0',
      },
      ports: [
        { port: 8000, available: true, service: 'Supabase API gateway' },
      ],
    });
  });
});
