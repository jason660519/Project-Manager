import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConnectedInstanceRows } from '../lib/integrations/mappers/connected-instances';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolveProfile(profile: 'minimal' | 'dev') {
  const raw = execFileSync(
    process.execPath,
    [path.join(ROOT, 'scripts/resolve-launcher-profile.mjs'), '--profile', profile, '--root', ROOT],
    { encoding: 'utf8' },
  );
  return JSON.parse(raw) as {
    auxiliaryPages: { entries: Array<{ id: string; url: string; openWhen: string }> };
    pm: { startupWaitSeconds: number };
  };
}

describe('launcher profile resolver (F40)', () => {
  it('minimal profile includes loopback sidecars only', () => {
    const profile = resolveProfile('minimal');
    const ids = profile.auxiliaryPages.entries.map((e) => e.id);
    expect(ids).toContain('hermes-dashboard');
    expect(ids).toContain('openclaw-dashboard');
    expect(JSON.stringify(profile)).not.toContain('192.168.1.6');
  });

  it('dev profile merges intranet auxiliary URLs', () => {
    const profile = resolveProfile('dev');
    const urls = profile.auxiliaryPages.entries.map((e) => e.url);
    expect(urls.some((u) => u.includes('192.168.1.6'))).toBe(true);
    expect(profile.pm.startupWaitSeconds).toBeGreaterThanOrEqual(120);
  });

  it('connected instance dev seeds load from config/samples JSON', () => {
    const row = buildConnectedInstanceRows().find((r) => r.sourceId === 'living-room-ollama');
    expect(row?.port).toBe('11434');
    expect(row?.payload.discoverySource).toBe('launcher dev profile');
  });
});
