import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FileAccessPolicyApplyError,
  augmentArgsWithFileAccessPolicy,
  buildClaudeFileAccessSettings,
  isBrowserLaunchAllowed,
  supportsFileAccessEnforcement,
} from '../lib/bridge';
import type {
  BrowserAccessPolicy,
  ExternalFileAccessPolicy,
} from '../lib/types';

// Mock the Tauri core invoke so the enforcement write path is controllable.
const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const policy = (
  enabled: boolean,
  allowedBrowserIds: string[],
): BrowserAccessPolicy => ({ enabled, allowedBrowserIds });

describe('isBrowserLaunchAllowed (ADR-017 fail-closed browser gate)', () => {
  it('blocks when policy is undefined (governed launch must not fall open)', () => {
    expect(isBrowserLaunchAllowed(undefined)).toBe(false);
  });

  it('blocks when the master switch is disabled', () => {
    expect(isBrowserLaunchAllowed(policy(false, ['com.google.Chrome']))).toBe(false);
  });

  it('blocks when the allowlist is empty', () => {
    expect(isBrowserLaunchAllowed(policy(true, []))).toBe(false);
  });

  it('allows when enabled with a non-empty allowlist and no specific browser', () => {
    expect(isBrowserLaunchAllowed(policy(true, ['com.apple.Safari']))).toBe(true);
  });

  it('allows a specific browser only when it is in the allowlist', () => {
    const p = policy(true, ['com.apple.Safari', 'com.google.Chrome']);
    expect(isBrowserLaunchAllowed(p, 'com.google.Chrome')).toBe(true);
    expect(isBrowserLaunchAllowed(p, 'org.mozilla.firefox')).toBe(false);
  });
});

describe('buildClaudeFileAccessSettings (external-file policy → Claude permissions)', () => {
  const build = (entries: ExternalFileAccessPolicy['entries']) =>
    buildClaudeFileAccessSettings({ entries, requireConfirmForUnlisted: false });

  it('maps read → allow Read, deny Edit + Write', () => {
    const { permissions } = build([
      { path: '/ext/docs', kind: 'local-dir', permission: 'read' },
    ]);
    expect(permissions.allow).toContain('Read(/ext/docs/**)');
    expect(permissions.deny).toContain('Edit(/ext/docs/**)');
    expect(permissions.deny).toContain('Write(/ext/docs/**)');
  });

  it('maps write → allow Read + Edit + Write', () => {
    const { permissions } = build([
      { path: '/ext/scratch', kind: 'local-dir', permission: 'write' },
    ]);
    expect(permissions.allow).toEqual(
      expect.arrayContaining([
        'Read(/ext/scratch/**)',
        'Edit(/ext/scratch/**)',
        'Write(/ext/scratch/**)',
      ]),
    );
    expect(permissions.deny).toHaveLength(0);
  });

  it('maps deny → deny Read + Edit + Write (deny always wins)', () => {
    const { permissions } = build([
      { path: '/secret', kind: 'local-dir', permission: 'deny' },
    ]);
    expect(permissions.deny).toEqual(
      expect.arrayContaining([
        'Read(/secret/**)',
        'Edit(/secret/**)',
        'Write(/secret/**)',
      ]),
    );
    expect(permissions.allow).toHaveLength(0);
  });

  it('normalizes trailing slashes and skips blank paths', () => {
    const { permissions } = build([
      { path: '/ext/docs///', kind: 'local-dir', permission: 'read' },
      { path: '   ', kind: 'other', permission: 'write' },
    ]);
    expect(permissions.allow).toEqual(['Read(/ext/docs/**)']);
  });
});

describe('augmentArgsWithFileAccessPolicy — non-Tauri (dry-run) paths', () => {
  const base = ['--prompt', 'do the thing'];

  it('returns baseArgs unchanged when there is no policy', async () => {
    expect(await augmentArgsWithFileAccessPolicy('claude', base, undefined)).toBe(base);
  });

  it('returns baseArgs unchanged when the policy has no entries', async () => {
    const empty: ExternalFileAccessPolicy = { entries: [], requireConfirmForUnlisted: false };
    expect(await augmentArgsWithFileAccessPolicy('claude', base, empty)).toBe(base);
  });

  it('returns baseArgs unchanged for an adapter PM cannot enforce', async () => {
    expect(supportsFileAccessEnforcement('cursor')).toBe(false);
    const p: ExternalFileAccessPolicy = {
      entries: [{ path: '/ext', kind: 'local-dir', permission: 'read' }],
      requireConfirmForUnlisted: false,
    };
    expect(await augmentArgsWithFileAccessPolicy('cursor', base, p)).toBe(base);
  });

  it('returns baseArgs unchanged for an enforceable command when not in Tauri (no spawn happens)', async () => {
    expect(supportsFileAccessEnforcement('claude')).toBe(true);
    const p: ExternalFileAccessPolicy = {
      entries: [{ path: '/ext', kind: 'local-dir', permission: 'read' }],
      requireConfirmForUnlisted: false,
    };
    expect(await augmentArgsWithFileAccessPolicy('claude', base, p)).toBe(base);
  });
});

describe('augmentArgsWithFileAccessPolicy — Tauri (enforced) path', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  });
  afterEach(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  const enforced: ExternalFileAccessPolicy = {
    entries: [{ path: '/ext/docs', kind: 'local-dir', permission: 'read' }],
    requireConfirmForUnlisted: false,
  };

  it('injects the --settings flag pointing at the written policy file', async () => {
    invokeMock.mockResolvedValueOnce('/tmp/policy-abc.json');
    const out = await augmentArgsWithFileAccessPolicy('claude', ['--p', 'x'], enforced);
    expect(out).toEqual(['--p', 'x', '--settings', '/tmp/policy-abc.json']);
    expect(invokeMock).toHaveBeenCalledWith(
      'write_engineer_policy_config',
      expect.objectContaining({ extension: 'json' }),
    );
  });

  it('throws FileAccessPolicyApplyError (aborts dispatch) when the policy write fails — never falls back to unrestricted args', async () => {
    invokeMock.mockRejectedValueOnce(new Error('disk full'));
    await expect(
      augmentArgsWithFileAccessPolicy('claude', ['--p', 'x'], enforced),
    ).rejects.toBeInstanceOf(FileAccessPolicyApplyError);
  });
});
