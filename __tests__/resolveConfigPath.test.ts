import { describe, expect, it } from 'vitest';
import { resolveConfigPath } from '../lib/storage/resolveConfigPath';

describe('resolveConfigPath', () => {
  it('returns input unchanged when it already ends with .project-manager.json', () => {
    expect(resolveConfigPath('/foo/bar/.project-manager.json')).toBe(
      '/foo/bar/.project-manager.json',
    );
  });

  it('appends .project-manager.json when input is a folder path', () => {
    expect(resolveConfigPath('/foo/bar')).toBe('/foo/bar/.project-manager.json');
  });

  it('strips trailing slash before appending', () => {
    expect(resolveConfigPath('/foo/bar/')).toBe('/foo/bar/.project-manager.json');
  });

  it('handles the real-world fixture path the user reported', () => {
    expect(resolveConfigPath('/Volumes/KLEVV-4T-1/Realestate_Management_Apps')).toBe(
      '/Volumes/KLEVV-4T-1/Realestate_Management_Apps/.project-manager.json',
    );
  });

  it('trims surrounding whitespace from a pasted path', () => {
    expect(resolveConfigPath('  /foo/bar  ')).toBe('/foo/bar/.project-manager.json');
  });

  it('does not double-append when the path already ends with the filename', () => {
    expect(resolveConfigPath('/foo/bar/.project-manager.json')).not.toContain(
      '.project-manager.json/.project-manager.json',
    );
  });
});
