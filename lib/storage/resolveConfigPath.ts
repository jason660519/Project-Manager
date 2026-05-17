const CONFIG_FILENAME = '.project-manager.json';

/**
 * Normalize a user-supplied path into a path that points at the
 * `.project-manager.json` file itself.
 *
 * Accepts either:
 *   - a folder path (e.g. `/foo/bar`) → returns `/foo/bar/.project-manager.json`
 *   - a folder path with trailing slash (e.g. `/foo/bar/`) → same as above
 *   - a fully-qualified config path (e.g. `/foo/bar/.project-manager.json`)
 *     → returned unchanged
 *
 * Surrounding whitespace is trimmed first because paths are usually pasted.
 *
 * Why this exists: the Rust `read_config` command refuses to read a
 * directory (`Is a directory (os error 21)`), so the UI must resolve the
 * file path before invoking the bridge. Keeping the rule in one place also
 * means the stored `configPath` in `ProjectEntry` always points at a file,
 * which the sync feature relies on.
 */
export function resolveConfigPath(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (trimmed.endsWith(`/${CONFIG_FILENAME}`) || trimmed === CONFIG_FILENAME) {
    return trimmed;
  }
  return `${trimmed}/${CONFIG_FILENAME}`;
}
