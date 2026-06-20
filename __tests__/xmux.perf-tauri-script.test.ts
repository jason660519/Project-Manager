import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('xmux Tauri performance script', () => {
  it('prints sample JSON with native PTY measured fields', () => {
    const output = execFileSync('node', ['scripts/xmux-perf-tauri.mjs', '--sample', '--json'], {
      encoding: 'utf8',
    });
    const report = JSON.parse(output) as {
      status: string;
      targetUrl: string;
      terminal: {
        nativePtyAvailable: boolean;
        bytesRequested: number;
        bytesRead: number;
        elapsedMs: number;
        throughputBytesPerSecond: number;
        sentinelSeen: boolean;
        notes: string[];
      };
    };

    expect(report.status).toBe('sample');
    expect(report.targetUrl).toContain('/xmux');
    expect(report.terminal.nativePtyAvailable).toBe(true);
    expect(report.terminal.bytesRequested).toBeGreaterThan(0);
    expect(report.terminal.bytesRead).toBeGreaterThan(0);
    expect(report.terminal.elapsedMs).toBeGreaterThan(0);
    expect(report.terminal.throughputBytesPerSecond).toBeGreaterThan(0);
    expect(report.terminal.sentinelSeen).toBe(true);
    expect(report.terminal.notes).toEqual([]);
  });

  it('documents the Tauri + pilot runner options', () => {
    const output = execFileSync('node', ['scripts/xmux-perf-tauri.mjs', '--help'], {
      encoding: 'utf8',
    });

    expect(output).toContain('xmux Tauri performance benchmark');
    expect(output).toContain('tauri-pilot');
    expect(output).toContain('--no-start');
    expect(output).toContain('--bytes');
  });
});
