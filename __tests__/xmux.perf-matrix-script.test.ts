import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('xmux performance matrix script', () => {
  it('prints sample JSON with median throughput by payload size', () => {
    const output = execFileSync('node', ['scripts/xmux-perf-matrix.mjs', '--sample', '--json'], {
      encoding: 'utf8',
    });
    const report = JSON.parse(output) as {
      status: string;
      payloadBytes: number[];
      runsPerPayload: number;
      matrix: Array<{
        bytes: number;
        runs: Array<{
          throughputBytesPerSecond: number;
          elapsedMs: number;
          status: string;
        }>;
        medianThroughputBytesPerSecond: number;
        minThroughputBytesPerSecond: number;
        maxThroughputBytesPerSecond: number;
      }>;
      summary: {
        fastestBytes: number;
        slowestBytes: number;
      };
    };

    expect(report.status).toBe('sample');
    expect(report.payloadBytes.length).toBeGreaterThanOrEqual(3);
    expect(report.runsPerPayload).toBeGreaterThanOrEqual(2);
    expect(report.matrix).toHaveLength(report.payloadBytes.length);
    for (const row of report.matrix) {
      expect(report.payloadBytes).toContain(row.bytes);
      expect(row.runs).toHaveLength(report.runsPerPayload);
      expect(row.medianThroughputBytesPerSecond).toBeGreaterThan(0);
      expect(row.minThroughputBytesPerSecond).toBeGreaterThan(0);
      expect(row.maxThroughputBytesPerSecond).toBeGreaterThanOrEqual(row.minThroughputBytesPerSecond);
    }
    expect(report.summary.fastestBytes).toBeGreaterThan(0);
    expect(report.summary.slowestBytes).toBeGreaterThan(0);
  });

  it('writes the sample report to an output directory', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'xmux-perf-matrix-'));
    const output = execFileSync(
      'node',
      ['scripts/xmux-perf-matrix.mjs', '--sample', '--json', '--output-dir', outputDir],
      { encoding: 'utf8' },
    );
    const report = JSON.parse(output) as { reportPath: string };
    const written = JSON.parse(readFileSync(report.reportPath, 'utf8')) as { reportPath: string };

    expect(report.reportPath.startsWith(outputDir)).toBe(true);
    expect(written.reportPath).toBe(report.reportPath);
  });

  it('documents matrix runner options', () => {
    const output = execFileSync('node', ['scripts/xmux-perf-matrix.mjs', '--help'], {
      encoding: 'utf8',
    });

    expect(output).toContain('xmux performance matrix');
    expect(output).toContain('--payloads');
    expect(output).toContain('--runs');
    expect(output).toContain('xmux:perf:tauri');
  });
});
