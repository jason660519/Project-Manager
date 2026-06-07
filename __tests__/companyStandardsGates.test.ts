import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { createDefaultTerminalBoundaries, evaluateTerminalCommand } from '../lib/ai-assistants/terminalBoundaries';
import {
  STANDARDS_GATES_REGISTRY,
  formatGateNpmCommand,
  getBlockingGatesInOrder,
  getGateInvocation,
  getStandardsGate,
} from '../lib/companyStandards/standardsGates';

const REPO_ROOT = join(__dirname, '..');

describe('standardsGates registry', () => {
  it('has unique gate ids', () => {
    const ids = STANDARDS_GATES_REGISTRY.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists blocking gates in order', () => {
    const blocking = getBlockingGatesInOrder();
    expect(blocking.map((g) => g.id)).toEqual(['i18n', 'docs']);
  });

  it('maps blocking gates to package.json scripts', () => {
    const pkg = JSON.parse(
      readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'),
    ) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    for (const gate of getBlockingGatesInOrder()) {
      expect(gate.npmScript).toBeTruthy();
      expect(scripts[gate.npmScript!]).toBeTruthy();
    }
  });

  it('i18n:check script runs the UI i18n checker', () => {
    const pkg = JSON.parse(
      readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['i18n:check']).toContain('check-ui-i18n');
  });

  it('returns npm run invocation for runnable gates', () => {
    expect(getGateInvocation('i18n')).toEqual({
      command: 'npm',
      args: ['run', 'i18n:check'],
    });
  });

  it('throws for unknown gate id', () => {
    expect(() => getStandardsGate('unknown' as 'i18n')).toThrow(/Unknown standards gate/);
  });
});

describe('standards gate terminal policy', () => {
  it('allows npm run for registered blocking scripts', () => {
    for (const gate of getBlockingGatesInOrder()) {
      const line = formatGateNpmCommand(gate);
      expect(evaluateTerminalCommand(line, createDefaultTerminalBoundaries())).toBe('allowed');
    }
  });

  it('blocks commands outside the whitelist under default-deny', () => {
    expect(evaluateTerminalCommand('curl http://example.com', createDefaultTerminalBoundaries())).toBe(
      'blocked',
    );
  });
});
