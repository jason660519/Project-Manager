import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

function runPmSystem(args: string[]) {
  return spawnSync('node', ['scripts/pm-system.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

describe('PM System dry-run CLI wrapper', () => {
  it('prints an install dry-run plan without host mutation', () => {
    const result = runPmSystem(['install', '--dry-run']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('PM System install plan: dry_run');
    expect(result.stdout).toContain('No Docker, filesystem, network, or secret mutation');
    expect(result.stdout).toContain('- run-pm-migrations');
  });

  it('requires dry-run until live service control is implemented', () => {
    const result = runPmSystem(['install']);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('dry-run planning only');
  });

  it('blocks restore and upgrade dry-runs until explicit safety inputs exist', () => {
    const restore = runPmSystem(['restore', '--dry-run']);
    const upgrade = runPmSystem(['upgrade', '--dry-run']);

    expect(restore.status).toBe(1);
    expect(restore.stdout).toContain('Restore is blocked');
    expect(upgrade.status).toBe(1);
    expect(upgrade.stdout).toContain('Upgrade is blocked');
  });
});
