import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('xmux runtime performance script', () => {
  it('prints sample JSON with the runtime benchmark schema', () => {
    const output = execFileSync('node', ['scripts/xmux-perf-runtime.mjs', '--sample', '--json'], {
      encoding: 'utf8',
    });
    const report = JSON.parse(output) as {
      status: string;
      targetUrl: string;
      route: {
        domContentLoadedMs: number;
        xmuxReadyMs: number;
      };
      layoutPersistence: {
        storageWritesDuringResize: number;
        flushLatencyMs: number;
      };
      terminal: {
        nativePtyAvailable: boolean;
        bytesRequested: number;
        bytesRead: number;
        elapsedMs: number;
        throughputBytesPerSecond: number;
        sentinelSeen: boolean;
        notes: string[];
      };
      consoleErrors: string[];
    };

    expect(report.status).toBe('sample');
    expect(report.targetUrl).toContain('/xmux');
    expect(report.route.domContentLoadedMs).toBeGreaterThanOrEqual(0);
    expect(report.route.xmuxReadyMs).toBeGreaterThanOrEqual(0);
    expect(report.layoutPersistence.storageWritesDuringResize).toBeGreaterThanOrEqual(0);
    expect(report.layoutPersistence.flushLatencyMs).toBeGreaterThanOrEqual(0);
    expect(report.terminal.nativePtyAvailable).toBe(false);
    expect(report.terminal.bytesRequested).toBeGreaterThan(0);
    expect(report.terminal.bytesRead).toBeGreaterThanOrEqual(0);
    expect(report.terminal.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(report.terminal.throughputBytesPerSecond).toBeGreaterThanOrEqual(0);
    expect(report.terminal.sentinelSeen).toBe(false);
    expect(report.terminal.notes.length).toBeGreaterThan(0);
    expect(report.consoleErrors).toEqual([]);
  });

  it('documents how to run the live benchmark', () => {
    const output = execFileSync('node', ['scripts/xmux-perf-runtime.mjs', '--help'], {
      encoding: 'utf8',
    });

    expect(output).toContain('xmux runtime performance benchmark');
    expect(output).toContain('--url');
    expect(output).toContain('--json');
    expect(output).toContain('native PTY');
  });
});
