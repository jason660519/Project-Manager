import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('xmux static performance report', () => {
  it('reports the P0 xmux performance guardrails as JSON', () => {
    const output = execFileSync('node', ['scripts/xmux-perf-static.mjs', '--json'], {
      encoding: 'utf8',
    });
    const report = JSON.parse(output) as {
      terminal: {
        webglAddonLoaded: boolean;
        ptyOutputBatched: boolean;
        ptyExitHandled: boolean;
        nativePtyBenchmarkHook: boolean;
        tauriPerfRunner: boolean;
        matrixPerfRunner: boolean;
      };
      layout: {
        persistDebounceMs: number;
      };
      nativeBrowserConsole: {
        captureInstallerBytes: number;
        entriesPollBytes: number;
        clearPollBytes: number;
        entriesPollToInstallerRatio: number;
      };
      nativeBrowserCreate: {
        reusesExistingChild: boolean;
      };
    };

    expect(report.terminal.webglAddonLoaded).toBe(true);
    expect(report.terminal.ptyOutputBatched).toBe(true);
    expect(report.terminal.ptyExitHandled).toBe(true);
    expect(report.terminal.nativePtyBenchmarkHook).toBe(true);
    expect(report.terminal.tauriPerfRunner).toBe(true);
    expect(report.terminal.matrixPerfRunner).toBe(true);
    expect(report.layout.persistDebounceMs).toBeGreaterThanOrEqual(150);
    expect(report.nativeBrowserConsole.entriesPollBytes).toBeLessThan(
      report.nativeBrowserConsole.captureInstallerBytes / 4,
    );
    expect(report.nativeBrowserConsole.clearPollBytes).toBeLessThan(
      report.nativeBrowserConsole.captureInstallerBytes / 4,
    );
    expect(report.nativeBrowserConsole.entriesPollToInstallerRatio).toBeLessThan(0.25);
    expect(report.nativeBrowserCreate.reusesExistingChild).toBe(true);
  });
});
