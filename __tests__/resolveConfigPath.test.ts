/**
 * Path resolution for the consolidated `.project-manager/` layout (ADR-008).
 *
 * After consolidation, the canonical config path is
 * `<root>/.project-manager/config.json`, not `<root>/.project-manager.json`.
 * Callers continue to pass folders or full paths and get back the new
 * canonical location.
 */

import { describe, expect, it } from 'vitest';
import { resolveConfigPath } from '../lib/storage/resolveConfigPath';

describe('resolveConfigPath', () => {
  it('appends .project-manager/config.json when input is a folder path', () => {
    expect(resolveConfigPath('/foo/bar')).toBe('/foo/bar/.project-manager/config.json');
  });

  it('strips a trailing slash before appending', () => {
    expect(resolveConfigPath('/foo/bar/')).toBe('/foo/bar/.project-manager/config.json');
  });

  it('handles the real-world fixture path the user reported', () => {
    expect(resolveConfigPath('/Volumes/KLEVV-4T-1/Realestate_Management_Apps')).toBe(
      '/Volumes/KLEVV-4T-1/Realestate_Management_Apps/.project-manager/config.json',
    );
  });

  it('trims surrounding whitespace from a pasted path', () => {
    expect(resolveConfigPath('  /foo/bar  ')).toBe('/foo/bar/.project-manager/config.json');
  });

  it('returns input unchanged when it already ends with .project-manager/config.json', () => {
    expect(resolveConfigPath('/foo/bar/.project-manager/config.json')).toBe(
      '/foo/bar/.project-manager/config.json',
    );
  });

  it('normalises the legacy single-file path to the new location', () => {
    expect(resolveConfigPath('/foo/bar/.project-manager.json')).toBe(
      '/foo/bar/.project-manager/config.json',
    );
  });

  it('returns input unchanged when it is the dashboard folder itself', () => {
    expect(resolveConfigPath('/foo/bar/.project-manager')).toBe(
      '/foo/bar/.project-manager/config.json',
    );
  });

  it('does not double-append when the path already ends with the canonical filename', () => {
    expect(resolveConfigPath('/foo/bar/.project-manager/config.json')).not.toContain(
      '.project-manager/config.json/.project-manager',
    );
  });
});
