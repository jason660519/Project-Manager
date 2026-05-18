import { NEW_CONFIG_REL_PATH, resolveProjectRoot } from './dashboardLayout';

/**
 * Normalize a user-supplied path into a path that points at the canonical
 * dashboard config file under the consolidated `.project-manager/` layout
 * (ADR-008): `<root>/.project-manager/config.json`.
 *
 * Accepts every input form callers actually produce — plain folder paths,
 * the dashboard folder itself, the new canonical config path, and the legacy
 * `.project-manager.json` single-file path — and collapses them to the same
 * canonical location so downstream code can treat `configPath` as opaque.
 *
 * Surrounding whitespace and trailing slashes are stripped first because
 * paths are usually pasted by the user.
 *
 * The Rust `read_config` command refuses to read a directory
 * (`Is a directory (os error 21)`), so the UI must resolve the file path
 * before invoking the bridge. Keeping the rule in one place also means the
 * stored `configPath` in `ProjectEntry` always points at a file, which the
 * sync feature relies on.
 */
export function resolveConfigPath(input: string): string {
  const root = resolveProjectRoot(input);
  return `${root}/${NEW_CONFIG_REL_PATH}`;
}
