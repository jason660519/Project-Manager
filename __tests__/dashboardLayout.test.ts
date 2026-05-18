/**
 * Path resolution for the consolidated `.project-manager/` dashboard layout
 * (ADR-008). Covers:
 *
 *   1. resolveDashboardDir — folder/config-path/legacy-path → <root>/.project-manager
 *   2. resolveLegacyConfigPath — same inputs → <root>/.project-manager.json
 *   3. detectStorageLayout — given a probe function, returns 'new' | 'legacy' | 'missing'
 *
 * These helpers are the basis for the migration logic that moves an old
 * `.project-manager.json` into the new folder on first read.
 */

import { describe, expect, it } from 'vitest';
import {
  detectStorageLayout,
  resolveDashboardDir,
  resolveLegacyConfigPath,
} from '../lib/storage/dashboardLayout';

describe('resolveDashboardDir', () => {
  it('returns <root>/.project-manager when given a plain folder', () => {
    expect(resolveDashboardDir('/foo/bar')).toBe('/foo/bar/.project-manager');
  });

  it('strips a trailing slash before appending', () => {
    expect(resolveDashboardDir('/foo/bar/')).toBe('/foo/bar/.project-manager');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveDashboardDir('  /foo/bar  ')).toBe('/foo/bar/.project-manager');
  });

  it('derives the folder when given the new config path', () => {
    expect(resolveDashboardDir('/foo/bar/.project-manager/config.json')).toBe(
      '/foo/bar/.project-manager',
    );
  });

  it('derives the folder when given the legacy single-file path', () => {
    expect(resolveDashboardDir('/foo/bar/.project-manager.json')).toBe(
      '/foo/bar/.project-manager',
    );
  });

  it('returns input unchanged when it is already a dashboard dir', () => {
    expect(resolveDashboardDir('/foo/bar/.project-manager')).toBe(
      '/foo/bar/.project-manager',
    );
  });
});

describe('resolveLegacyConfigPath', () => {
  it('returns <root>/.project-manager.json for a folder input', () => {
    expect(resolveLegacyConfigPath('/foo/bar')).toBe('/foo/bar/.project-manager.json');
  });

  it('derives <root>/.project-manager.json from the new config path', () => {
    expect(resolveLegacyConfigPath('/foo/bar/.project-manager/config.json')).toBe(
      '/foo/bar/.project-manager.json',
    );
  });

  it('returns the legacy path unchanged', () => {
    expect(resolveLegacyConfigPath('/foo/bar/.project-manager.json')).toBe(
      '/foo/bar/.project-manager.json',
    );
  });
});

describe('detectStorageLayout', () => {
  /**
   * The probe is a thin abstraction over "does this file exist on disk".
   * In production it's the Tauri bridge; here we feed deterministic fixtures.
   */
  function probeFactory(presentPaths: Set<string>) {
    return (path: string) => presentPaths.has(path);
  }

  it('returns "new" when <root>/.project-manager/config.json exists', () => {
    const probe = probeFactory(new Set(['/foo/.project-manager/config.json']));
    expect(detectStorageLayout('/foo', probe)).toBe('new');
  });

  it('returns "legacy" when only <root>/.project-manager.json exists', () => {
    const probe = probeFactory(new Set(['/foo/.project-manager.json']));
    expect(detectStorageLayout('/foo', probe)).toBe('legacy');
  });

  it('returns "missing" when neither exists', () => {
    const probe = probeFactory(new Set());
    expect(detectStorageLayout('/foo', probe)).toBe('missing');
  });

  it('prefers "new" when both exist (mid-migration safety)', () => {
    const probe = probeFactory(
      new Set([
        '/foo/.project-manager/config.json',
        '/foo/.project-manager.json',
      ]),
    );
    expect(detectStorageLayout('/foo', probe)).toBe('new');
  });

  it('accepts a project given by its config path, not folder', () => {
    const probe = probeFactory(new Set(['/foo/.project-manager/config.json']));
    expect(detectStorageLayout('/foo/.project-manager/config.json', probe)).toBe('new');
  });
});
