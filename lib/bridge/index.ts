/**
 * Bridge module — wraps Tauri IPC commands.
 *
 * All runtime OS operations (FS read/write, process spawn/kill) go through
 * this module. In development (browser), it falls back to the legacy
 * /api/bridge/execute HTTP route so the Next.js dev server still works.
 */

import { migrateConfig } from '../storage';
import type { ProjectManagerConfig } from '../types';
import { KEY_PERSONAL_SYSTEM_CLI_EXPOSURE } from '../storage/keys';

// ── Tauri detection ───────────────────────────────────────────────────────────

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(command, args);
}

function commandBasename(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] ?? trimmed;
}

function loadSystemCliExposureMapForPolicy(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY_PERSONAL_SYSTEM_CLI_EXPOSURE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, boolean> = {};
    for (const [name, exposed] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof name === 'string' && typeof exposed === 'boolean') out[name] = exposed;
    }
    return out;
  } catch {
    return {};
  }
}

async function assertCommandPolicyAllows(command: string): Promise<void> {
  if (!isTauri()) return;
  const base = commandBasename(command);
  if (!base) return;
  const inventory = await listGlobalCliInventory();
  const isSystemCli = inventory.some((entry) => entry.command === base);
  if (!isSystemCli) return;
  const exposure = loadSystemCliExposureMapForPolicy();
  if (exposure[base] === true) return;
  throw new Error(
    `Command "${base}" is blocked by System CLI policy. Enable it in Plugins > Commands (Global CLI Inventory) before dispatch.`,
  );
}

// ── Config operations ─────────────────────────────────────────────────────────

export async function readConfig(path: string): Promise<ProjectManagerConfig> {
  if (!isTauri()) throw new Error('readConfig requires Tauri runtime');
  // Pipe through schema migration so older v1 files on disk are transparently
  // upgraded — the in-memory shape is always current (ADR-006).
  const raw = await invoke<unknown>('read_config', { path });
  return migrateConfig(raw);
}

export interface MigrateProjectLayoutResult {
  migrated: boolean;
  configPath: string;
}

/**
 * Move a project from the legacy `<root>/.project-manager.json` layout to
 * the consolidated `<root>/.project-manager/config.json` layout (ADR-008).
 * Idempotent: returns `{ migrated: false }` if the project is already on the
 * new layout or has no config at all.
 */
export async function migrateProjectLayout(
  projectRoot: string,
): Promise<MigrateProjectLayoutResult> {
  if (!isTauri()) throw new Error('migrateProjectLayout requires Tauri runtime');
  const raw = await invoke<{ migrated: boolean; config_path: string }>(
    'migrate_project_layout',
    { projectRoot },
  );
  return { migrated: raw.migrated, configPath: raw.config_path };
}

export async function writeConfig(path: string, config: ProjectManagerConfig): Promise<void> {
  if (!isTauri()) throw new Error('writeConfig requires Tauri runtime');
  return invoke<void>('write_config', { path, config });
}

export interface InitializeProjectResult {
  configPath: string;
  createdDirs: string[];
}

export type InitializeProjectMode = 'create' | 'merge' | 'overwrite';

/**
 * Create the `.project-manager/` dashboard folder with `config.json`,
 * `features/`, and `dev-logs/` (ADR-008). See
 * `lib/storage/createProjectScaffold.ts` for config assembly before calling this.
 */
export async function initializeProject(
  projectRoot: string,
  config: ProjectManagerConfig,
  mode: InitializeProjectMode,
): Promise<InitializeProjectResult> {
  if (!isTauri()) throw new Error('initializeProject requires Tauri runtime');
  const raw = await invoke<{ config_path: string; created_dirs: string[] }>('initialize_project', {
    projectRoot,
    config,
    mode,
  });
  return { configPath: raw.config_path, createdDirs: raw.created_dirs };
}

/**
 * Delete the dashboard config file from disk. Accepts both the new layout
 * (`.project-manager/config.json`) and the legacy single-file form
 * (`.project-manager.json`); Rust refuses anything else so a typo in
 * `configPath` cannot wipe an unrelated file.
 */
export async function deleteConfig(path: string): Promise<void> {
  if (!isTauri()) throw new Error('deleteConfig requires Tauri runtime');
  return invoke<void>('delete_config', { path });
}

export async function scanProjects(root: string): Promise<string[]> {
  if (!isTauri()) throw new Error('scanProjects requires Tauri runtime');
  return invoke<string[]>('scan_projects', { root });
}

/** Detect a local Git repository's GitHub origin URL. Returns null when no GitHub origin exists. */
export async function detectGithubRepoUrl(projectRoot: string): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>('detect_github_repo_url', { projectRoot });
}

// ── Project registry — desktop ↔ web sync ────────────────────────────────────

export interface RegistryEntry {
  configPath: string;
}

/** Returns all entries in the shared project registry (~/.project-manager/registry.json). */
export async function listRegistry(): Promise<RegistryEntry[]> {
  if (!isTauri()) return [];
  return invoke<RegistryEntry[]>('list_registry');
}

/** Appends configPath to the registry if not already present. No-op in browser. */
export async function addToRegistry(configPath: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('add_to_registry', { configPath });
}

/** Removes configPath from the registry. No-op in browser. */
export async function removeFromRegistry(configPath: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('remove_from_registry', { configPath });
}

// ── Agent process management ──────────────────────────────────────────────────

export interface SpawnAgentOptions {
  /** The CLI binary name, e.g. "claude" or "cursor" */
  command: string;
  /** Pre-processed argument list (placeholders already substituted) */
  args: string[];
  /** Absolute path to the project root */
  workingDir: string;
}

/**
 * Spawn an agent process and return its PID.
 * Stdout/stderr lines are emitted as Tauri events:
 *   - "agent-stdout" { pid, line }
 *   - "agent-stderr" { pid, line }
 *   - "agent-exit"   { pid, code }
 */
export async function spawnAgent(opts: SpawnAgentOptions): Promise<number> {
  if (isTauri()) {
    await assertCommandPolicyAllows(opts.command);
    return invoke<number>('spawn_agent', {
      command: opts.command,
      args: opts.args,
      workingDir: opts.workingDir,
    });
  }

  // Dev-server fallback: call the legacy HTTP bridge (dry-run only)
  const res = await fetch('/api/bridge/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: opts.command,
      args: opts.args,
      workingDir: opts.workingDir,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return 0; // no real PID in browser mode
}

export async function killProcess(pid: number): Promise<void> {
  if (!isTauri()) return; // no-op in browser
  return invoke<void>('kill_process', { pid });
}

export interface SpawnTerminalOptions {
  /** The CLI binary name, e.g. "claude" */
  command: string;
  /** Pre-processed argument list (placeholders already substituted) */
  args: string[];
  /** Working directory the terminal opens in */
  cwd: string;
}

/**
 * Open a new system Terminal window running `command` with `args` in `cwd`.
 *
 * Unlike `spawnAgent`, the terminal app owns the process — PM does NOT
 * capture stdout/stderr. Use for interactive CLI agents (Claude Code
 * interactive mode, Aider, Codex) where the user types directly.
 *
 * Throws in `next dev` (no Tauri runtime).
 */
export async function spawnTerminal(opts: SpawnTerminalOptions): Promise<void> {
  if (!isTauri()) throw new Error('spawnTerminal requires Tauri runtime');
  await assertCommandPolicyAllows(opts.command);
  return invoke<void>('spawn_terminal', {
    command: opts.command,
    args: opts.args,
    cwd: opts.cwd,
  });
}

/**
 * Open the system Terminal app with an interactive shell in `cwd` (no command).
 * macOS: Terminal.app via AppleScript. Dev browser mode uses `/api/xmux/open-terminal`.
 */
export async function openTerminalAtPath(cwd: string): Promise<void> {
  const trimmed = cwd.trim();
  if (!trimmed) throw new Error('openTerminalAtPath: cwd must not be empty');
  if (isTauri()) {
    return invoke<void>('open_terminal_at_path', { cwd: trimmed });
  }
  const res = await fetch('/api/xmux/open-terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd: trimmed }),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; output?: string };
  if (!res.ok || body.success === false) {
    throw new Error(body.output ?? `open-terminal failed (${res.status})`);
  }
}

// ── MCP server lifecycle ──────────────────────────────────────────────────────

export type McpRunStatus =
  | { phase: 'running'; pid: number }
  | { phase: 'stopped'; code: number }
  | { phase: 'errored'; message: string };

export interface McpStatus {
  pluginId: string;
  status: McpRunStatus;
  startedAt?: string;
  lastStatusChange: string;
}

export interface McpSpawnOptions {
  pluginId: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/** Spawn an MCP server. Throws if the plugin is already Running. */
export async function mcpSpawn(opts: McpSpawnOptions): Promise<McpStatus> {
  if (!isTauri()) throw new Error('mcpSpawn requires Tauri runtime');
  return invoke<McpStatus>('mcp_spawn', {
    pluginId: opts.pluginId,
    command: opts.command,
    args: opts.args,
    env: opts.env ?? null,
    cwd: opts.cwd ?? null,
  });
}

/** Signal the MCP server with this plugin_id to terminate. No-op if not running. */
export async function mcpKill(pluginId: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('mcp_kill', { pluginId });
}

/** Convenience: kill then re-spawn with the same configuration. */
export async function mcpRestart(opts: McpSpawnOptions): Promise<McpStatus> {
  await mcpKill(opts.pluginId);
  // The waiter task needs a tick to flip status; wait briefly so the next spawn
  // doesn't trip the "already running" guard before the kill propagates.
  await new Promise((r) => setTimeout(r, 50));
  return mcpSpawn(opts);
}

/** All MCP servers PM currently tracks. Plugins never spawned are absent. */
export async function mcpStatusAll(): Promise<McpStatus[]> {
  if (!isTauri()) return [];
  return invoke<McpStatus[]>('mcp_status_all');
}

/** Last `tail` lines from the in-memory rolling buffer. Empty if not tracked. */
export async function mcpLogs(pluginId: string, tail = 200): Promise<string> {
  if (!isTauri()) return '';
  return invoke<string>('mcp_logs', { pluginId, tail });
}

/** Absolute path to the mcp-logs directory (creates it if missing). */
export async function mcpLogsDir(): Promise<string> {
  if (!isTauri()) throw new Error('mcpLogsDir requires Tauri runtime');
  return invoke<string>('mcp_logs_dir');
}

export interface McpLogPayload {
  pluginId: string;
  level: 'stdout' | 'stderr';
  line: string;
  timestamp: string;
}

export interface McpStatusPayload {
  pluginId: string;
  status: McpRunStatus;
}

export function onMcpLog(cb: (p: McpLogPayload) => void): Promise<UnlistenFn> {
  return listen<McpLogPayload>('mcp-log', cb);
}

export function onMcpStatus(cb: (p: McpStatusPayload) => void): Promise<UnlistenFn> {
  return listen<McpStatusPayload>('mcp-status', cb);
}

/** Open a file or directory in the OS's default handler (Finder/Explorer/xdg-open). */
export async function openPath(path: string): Promise<void> {
  if (!isTauri()) throw new Error('openPath requires Tauri runtime');
  return invoke<void>('open_path', { path });
}

// ── Editor integration ───────────────────────────────────────────────────────

export interface OpenInEditorOptions {
  /** Editor CLI name, e.g. "codium", "code", "cursor" */
  editor: string;
  /** Absolute path to the file or directory to open */
  path: string;
  /** Optional line number (1-based) for --goto protocol */
  line?: number;
}

/**
 * Open a file or directory in an external editor (VSCodium, Cursor, VS Code,
 * etc). Supports optional line number for `--goto` (`-g`) protocol.
 * No-op outside Tauri (browser dev mode).
 */
export async function openInEditor(opts: OpenInEditorOptions): Promise<void> {
  if (!isTauri()) {
    console.warn('[bridge] openInEditor: not available in browser mode', opts);
    return;
  }
  return invoke<void>('open_in_editor', {
    editor: opts.editor,
    path: opts.path,
    line: opts.line ?? null,
  });
}

/**
 * Write content to a plain-text file. Creates parent directories if needed.
 * In Tauri mode uses the Rust bridge; in browser dev mode uses
 * the /api/editor/write-file Next.js route.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  if (isTauri()) {
    return invoke<void>('write_file', { path, content });
  }
  // Browser dev mode: proxy through Next.js API route
  if (typeof window === 'undefined') return;
  const res = await fetch('/api/editor/write-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Write failed (${res.status})`);
  }
}

/** Check if a command exists in the user's system PATH. */
export async function checkCommandExistsTauri(command: string): Promise<boolean> {
  if (!isTauri()) return false;
  return invoke<boolean>('check_command_exists', { command });
}

export interface ResolvedInstallPath {
  /** Absolute path of the executable as found via PATH lookup. */
  commandPath: string | null;
  /** macOS .app bundle path when `appName` resolves to an installed application. */
  appBundlePath: string | null;
}

/**
 * Resolve a CLI command to its absolute path (via `which`) and, on macOS, look
 * up an .app bundle for the supplied application name. Returns null fields when
 * not found. Outside Tauri runtime both fields are null.
 */
export async function resolveInstallPath(
  command: string,
  appName?: string,
): Promise<ResolvedInstallPath> {
  if (!isTauri()) return { commandPath: null, appBundlePath: null };
  const raw = await invoke<{
    commandPath?: string | null;
    appBundlePath?: string | null;
  }>('resolve_install_path', { command, appName: appName ?? null });
  return {
    commandPath: raw.commandPath ?? null,
    appBundlePath: raw.appBundlePath ?? null,
  };
}

export interface GlobalCliInventoryEntry {
  command: string;
  path: string;
  source: string;
  scope: 'user' | 'system';
}

/** Enumerate executable CLI binaries visible on current PATH. */
export async function listGlobalCliInventory(): Promise<GlobalCliInventoryEntry[]> {
  if (!isTauri()) return [];
  return invoke<GlobalCliInventoryEntry[]>('list_global_cli_inventory');
}

/**
 * Discriminated result of {@link pickProjectFolders}. Callers MUST switch on
 * `status` so "user cancelled" and "non-Tauri environment" never collapse
 * into the same code path (the previous `string[] | null` API made them
 * indistinguishable).
 */
export type PickProjectFoldersResult =
  | { status: 'ok'; paths: string[] }
  | { status: 'cancelled' }
  | { status: 'unsupported' };

/**
 * Open the native folder picker (Finder on macOS). With `multiple: true`,
 * Cmd-click several folders to batch-import projects.
 *
 * Returns a discriminated union so callers can react differently to a cancel
 * vs. a non-Tauri environment.
 */
export async function pickProjectFolders(options?: {
  multiple?: boolean;
  title?: string;
}): Promise<PickProjectFoldersResult> {
  if (!isTauri()) return { status: 'unsupported' };
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    directory: true,
    multiple: options?.multiple ?? true,
    title: options?.title ?? 'Select project folder(s)',
  });
  if (selected === null) return { status: 'cancelled' };
  const paths = Array.isArray(selected) ? selected : [selected];
  return { status: 'ok', paths };
}

// ── Skills (markdown packages on disk) ───────────────────────────────────────

export interface SkillFileInfo {
  relPath: string;
  absPath: string;
  modified: string;
  size: number;
}

/** PM's default skills directory: ~/.claude/skills (cross-platform). */
export async function skillDefaultDir(): Promise<string> {
  if (!isTauri()) return '';
  return invoke<string>('skill_default_dir');
}

/** Scan `skillsDir` for `.md` files (top level + 1 subdir deep). */
export async function skillList(skillsDir: string): Promise<SkillFileInfo[]> {
  if (!isTauri()) return [];
  return invoke<SkillFileInfo[]>('skill_list', { skillsDir });
}

/**
 * Download a `.md` from `url` into `skillsDir`. `fileName` overrides the
 * basename derived from the URL. Returns the absolute path of the new file.
 */
export async function skillInstallFromUrl(
  url: string,
  skillsDir: string,
  fileName?: string,
): Promise<string> {
  if (!isTauri()) throw new Error('skillInstallFromUrl requires Tauri runtime');
  return invoke<string>('skill_install_from_url', {
    url,
    skillsDir,
    fileName: fileName ?? null,
  });
}

/** Delete a skill file. Refused if `path` is outside `skillsDir`. */
export async function skillUninstall(path: string, skillsDir: string): Promise<void> {
  if (!isTauri()) throw new Error('skillUninstall requires Tauri runtime');
  return invoke<void>('skill_uninstall', { path, skillsDir });
}

/**
 * Write (or overwrite) a skill file at `absPath`.
 * The path must end with `.md` and must be inside `skillsDir`.
 * Parent directories are created automatically.
 */
export async function skillSave(absPath: string, skillsDir: string, content: string): Promise<void> {
  if (!isTauri()) throw new Error('skillSave requires Tauri runtime');
  return invoke<void>('skill_save', { path: absPath, skillsDir, content });
}

/** Move existing skill files into `newDir`. Returns the new absolute paths. */
export async function skillMoveFiles(paths: string[], newDir: string): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>('skill_move_files', { paths, newDir });
}

// ── MCP config injection (handed to child CLIs at dispatch time) ─────────────

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/** CLI commands → flag template appended for MCP config injection. */
const MCP_INJECTABLE_COMMANDS: Record<string, string[]> = {
  claude: ['--mcp-config', '{mcpConfigPath}'],
  aider: ['--mcp-config', '{mcpConfigPath}'],
};

/** Whether PM knows how to inject MCP into this CLI command. */
export function supportsMcpInjection(command: string): boolean {
  return command in MCP_INJECTABLE_COMMANDS;
}

/**
 * The flag fragment PM appends for `command`, with the placeholder still in
 * place. Useful for UI hints. Returns null when PM doesn't know the command.
 */
export function mcpInjectionFlag(command: string): string | null {
  const tpl = MCP_INJECTABLE_COMMANDS[command];
  return tpl ? tpl.join(' ') : null;
}

/** Write a temporary mcp_config.json and return its absolute path. Tauri only. */
export async function writeMcpConfig(
  servers: Record<string, McpServerConfig>,
): Promise<string> {
  if (!isTauri()) throw new Error('writeMcpConfig requires Tauri runtime');
  return invoke<string>('write_mcp_config', { servers });
}

/**
 * If PM knows how to inject MCP into `command`, write a temp config from the
 * given servers and return baseArgs + the MCP flag. Returns baseArgs unchanged
 * when the command is unknown, no servers are given, or the write fails (e.g.
 * outside Tauri).
 */
export async function augmentArgsWithMcp(
  command: string,
  baseArgs: string[],
  servers: Record<string, McpServerConfig>,
): Promise<string[]> {
  const template = MCP_INJECTABLE_COMMANDS[command];
  if (!template) return baseArgs;
  if (Object.keys(servers).length === 0) return baseArgs;
  try {
    const path = await writeMcpConfig(servers);
    const mcpArgs = template.map((a) => a.replaceAll('{mcpConfigPath}', path));
    return [...baseArgs, ...mcpArgs];
  } catch {
    return baseArgs;
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

export type AgentStdioPayload = { pid: number; line: string };
export type AgentExitPayload = { pid: number; code: number };
export type UnlistenFn = () => void;

async function listen<T>(event: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  const { listen: tauriListen } = await import('@tauri-apps/api/event');
  return tauriListen<T>(event, (e) => cb(e.payload));
}

export function onAgentStdout(cb: (p: AgentStdioPayload) => void): Promise<UnlistenFn> {
  return listen<AgentStdioPayload>('agent-stdout', cb);
}

export function onAgentStderr(cb: (p: AgentStdioPayload) => void): Promise<UnlistenFn> {
  return listen<AgentStdioPayload>('agent-stderr', cb);
}

export function onAgentExit(cb: (p: AgentExitPayload) => void): Promise<UnlistenFn> {
  return listen<AgentExitPayload>('agent-exit', cb);
}

// ── Config file watch ─────────────────────────────────────────────────────────

export type ConfigChangedPayload = { path: string; config: ProjectManagerConfig };

/** Start a 2-second poll loop in Rust for the given config path. No-op in browser. */
export async function watchConfig(path: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('watch_config', { path });
}

/** Subscribe to config-changed events emitted by watchConfig. */
export function onConfigChanged(
  cb: (payload: ConfigChangedPayload) => void,
): Promise<UnlistenFn> {
  return listen<ConfigChangedPayload>('config-changed', cb);
}

// ── GitHub integration ────────────────────────────────────────────────────────

export interface GitHubFeature {
  id: string;
  name: string;
  category: string;
  status: string;
  progress: number;
  daysIdle?: number;
  notes?: string;
}

/** Fetch open PRs + issues from a GitHub repo and map them to feature cards. Tauri only. */
export async function fetchGithubRepo(
  token: string,
  repoUrl: string,
): Promise<GitHubFeature[]> {
  if (isTauri()) {
    return invoke<GitHubFeature[]>('fetch_github_repo', { token, repoUrl });
  }
  // Browser mode fallback: proxy through the F04 repo API route (GraphQL).
  // Note: /api/github/sync is used by F15 (Issues tab) with a different response shape.
  const res = await fetch('/api/github/repo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `GitHub repo sync failed (${res.status})`);
  }
  const data = await res.json();
  return data.features as GitHubFeature[];
}

export interface GithubUpdatedPayload {
  repoUrl: string;
  features: GitHubFeature[];
}

/**
 * Start a background poll for a GitHub repo. Emits `github-updated` events every
 * `intervalSecs` seconds (default 300 = 5 min). No-op in browser dev mode.
 * The first tick is skipped so it does not double-fetch after the initial import.
 */
export async function startGithubPoll(
  token: string,
  repoUrl: string,
  intervalSecs = 300,
): Promise<void> {
  if (!isTauri()) return; // no-op in browser
  return invoke<void>('start_github_poll', { token, repoUrl, intervalSecs });
}

/** Subscribe to `github-updated` events emitted by `startGithubPoll`. */
export function onGithubUpdated(
  cb: (payload: GithubUpdatedPayload) => void,
): Promise<UnlistenFn> {
  return listen<GithubUpdatedPayload>('github-updated', cb);
}

export interface GithubIssuePayload {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  labels: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
  user?: string;
}

/** Fetch GitHub issues from a repository. Tauri only. */
export async function fetchGithubIssues(
  token: string,
  repoUrl: string,
): Promise<GithubIssuePayload[]> {
  if (!isTauri()) throw new Error('fetchGithubIssues requires Tauri runtime');
  return invoke<GithubIssuePayload[]>('fetch_github_issues', { token, repoUrl });
}

export interface CreateGithubIssueInput {
  repoUrl: string;
  title: string;
  body?: string;
}

export interface UpdateGithubIssueInput {
  repoUrl: string;
  issueNumber: number;
  title?: string;
  body?: string;
}

export interface CommentGithubIssueInput {
  repoUrl: string;
  issueNumber: number;
  comment: string;
}

export interface CloseGithubIssueInput {
  repoUrl: string;
  issueNumber: number;
  comment?: string;
}

export interface ReopenGithubIssueInput {
  repoUrl: string;
  issueNumber: number;
  comment?: string;
}

export interface GithubIssueCommentPayload {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  user?: string;
}

async function browserIssueMutation<T>(
  action: 'create' | 'update' | 'comment' | 'close_with_comment' | 'reopen_with_comment',
  payload: object,
): Promise<T> {
  const res = await fetch('/api/github/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `GitHub issue action failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Create a GitHub issue. Uses Tauri command in desktop; Next API route in browser dev. */
export async function createGithubIssue(
  token: string,
  input: CreateGithubIssueInput,
): Promise<GithubIssuePayload> {
  if (isTauri()) {
    return invoke<GithubIssuePayload>('create_github_issue', {
      token,
      repoUrl: input.repoUrl,
      title: input.title,
      body: input.body ?? null,
    });
  }
  return browserIssueMutation<GithubIssuePayload>('create', input);
}

/** Update issue title/body. Leaves unspecified fields unchanged. */
export async function updateGithubIssue(
  token: string,
  input: UpdateGithubIssueInput,
): Promise<GithubIssuePayload> {
  if (isTauri()) {
    return invoke<GithubIssuePayload>('update_github_issue', {
      token,
      repoUrl: input.repoUrl,
      issueNumber: input.issueNumber,
      title: input.title ?? null,
      body: input.body ?? null,
    });
  }
  return browserIssueMutation<GithubIssuePayload>('update', input);
}

/** Add a review/update comment to an issue. */
export async function commentGithubIssue(
  token: string,
  input: CommentGithubIssueInput,
): Promise<GithubIssuePayload> {
  if (isTauri()) {
    return invoke<GithubIssuePayload>('comment_github_issue', {
      token,
      repoUrl: input.repoUrl,
      issueNumber: input.issueNumber,
      comment: input.comment,
    });
  }
  return browserIssueMutation<GithubIssuePayload>('comment', input);
}

/** Close an issue and optionally append a closing comment. */
export async function closeGithubIssueWithComment(
  token: string,
  input: CloseGithubIssueInput,
): Promise<GithubIssuePayload> {
  if (isTauri()) {
    return invoke<GithubIssuePayload>('close_github_issue_with_comment', {
      token,
      repoUrl: input.repoUrl,
      issueNumber: input.issueNumber,
      comment: input.comment ?? null,
    });
  }
  return browserIssueMutation<GithubIssuePayload>('close_with_comment', input);
}

/** Reopen an issue and optionally append a reopening comment. */
export async function reopenGithubIssueWithComment(
  token: string,
  input: ReopenGithubIssueInput,
): Promise<GithubIssuePayload> {
  if (isTauri()) {
    return invoke<GithubIssuePayload>('reopen_github_issue_with_comment', {
      token,
      repoUrl: input.repoUrl,
      issueNumber: input.issueNumber,
      comment: input.comment ?? null,
    });
  }
  return browserIssueMutation<GithubIssuePayload>('reopen_with_comment', input);
}

/** Fetch issue comments ordered by newest first. */
export async function fetchGithubIssueComments(
  token: string,
  repoUrl: string,
  issueNumber: number,
): Promise<GithubIssueCommentPayload[]> {
  if (isTauri()) {
    return invoke<GithubIssueCommentPayload[]>('fetch_github_issue_comments', {
      token,
      repoUrl,
      issueNumber,
    });
  }

  const res = await fetch('/api/github/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'fetch_comments', repoUrl, issueNumber }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `GitHub issue comments failed (${res.status})`);
  }
  return res.json() as Promise<GithubIssueCommentPayload[]>;
}

// ── OS Keychain / dev plaintext file ──────────────────────────────────────────

/** Label for the active secret backend (`keychain` vs dev file). Tauri only. */
export async function getSecretsStorageBackend(): Promise<string> {
  if (!isTauri()) return 'localStorage';
  return invoke<string>('secrets_storage_backend');
}

/**
 * Store a secret in the OS keychain (Tauri only).
 * Uses `service` + `key` as the compound identifier so multiple secrets can
 * share the same service name without collision.
 */
export async function setSecret(service: string, key: string, value: string): Promise<void> {
  if (!isTauri()) throw new Error('setSecret requires Tauri runtime');
  return invoke<void>('set_secret', { service, key, value });
}

/**
 * Retrieve a secret from the OS keychain (Tauri only).
 * Returns `null` when no entry has been saved yet; throws on genuine access errors.
 */
export async function getSecret(service: string, key: string): Promise<string | null> {
  if (!isTauri()) throw new Error('getSecret requires Tauri runtime');
  return invoke<string | null>('get_secret', { service, key });
}

// ── GitHub token (Keychain in Tauri, localStorage fallback in dev) ───────────

const GITHUB_TOKEN_SERVICE = 'projectmanager';
const GITHUB_TOKEN_KEY = 'github-token';
const GITHUB_TOKEN_LS_FALLBACK = 'projectManager-key:github';
const GITHUB_TOKEN_LS_LEGACY = 'projectManager-github-token';

/**
 * Read the user's GitHub token.  Under Tauri release builds it lives in the OS
 * Keychain; under debug `tauri dev` it uses the same backend as other secrets
 * (`~/.project-manager/dev-secrets.json` by default). Browser `next dev` uses
 * localStorage.
 */
export async function getGithubToken(): Promise<string> {
  if (isTauri()) {
    const v = await getSecret(GITHUB_TOKEN_SERVICE, GITHUB_TOKEN_KEY);
    return v ?? '';
  }
  if (typeof window === 'undefined') return '';
  try {
    return (
      window.localStorage.getItem(GITHUB_TOKEN_LS_FALLBACK)
      ?? window.localStorage.getItem(GITHUB_TOKEN_LS_LEGACY)
      ?? ''
    );
  } catch {
    return '';
  }
}

/** Persist the GitHub token to the appropriate backend for the current runtime. */
export async function setGithubToken(value: string): Promise<void> {
  if (isTauri()) {
    return setSecret(GITHUB_TOKEN_SERVICE, GITHUB_TOKEN_KEY, value);
  }
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(GITHUB_TOKEN_LS_FALLBACK, value);
    } else {
      window.localStorage.removeItem(GITHUB_TOKEN_LS_FALLBACK);
    }
    window.localStorage.removeItem(GITHUB_TOKEN_LS_LEGACY);
  } catch {
    /* ignore */
  }
}

// ── Capability runtime (F23 schema v7) ────────────────────────────────────

/**
 * Capture a PNG screenshot via the Rust `capture_screenshot` command.
 * Returns base64 PNG bytes (without the `data:image/png;base64,` prefix).
 * Browser-mode (no Tauri) throws — screenshots require the desktop app.
 */
export async function captureScreenshot(): Promise<string> {
  if (!isTauri()) {
    throw new Error('Screenshots require the desktop app — not available in browser mode.');
  }
  return invoke<string>('capture_screenshot');
}

// ── Anthropic API (via Rust — key never touches renderer) ────────────────────

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | any;
}

export interface AnthropicResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callAnthropic(opts: {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  messages: AnthropicMessage[];
  temperature?: number;
  /** UUID for this conversation — if provided alongside sessionsDir, auto-saves the session. */
  sessionId?: string;
  /** Absolute path to the sessions folder, e.g. `{projectRoot}/.project-manager/sessions`. */
  sessionsDir?: string;
  featureId?: string;
  projectId?: string;
}): Promise<AnthropicResponse> {
  if (isTauri()) {
    return invoke<AnthropicResponse>('call_anthropic', {
      apiKey: opts.apiKey,
      model: opts.model ?? 'claude-sonnet-4-6',
      maxTokens: opts.maxTokens ?? 4096,
      messages: opts.messages,
      temperature: opts.temperature ?? null,
      sessionId: opts.sessionId ?? null,
      sessionsDir: opts.sessionsDir ?? null,
      featureId: opts.featureId ?? null,
      projectId: opts.projectId ?? null,
    });
  }

  // Browser/dev mode: proxy through Next.js server route so the API key
  // stays on the server (read from ANTHROPIC_API_KEY env var), never in JS.
  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model ?? 'claude-sonnet-4-6',
      maxTokens: opts.maxTokens ?? 4096,
      messages: opts.messages,
      temperature: opts.temperature,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<AnthropicResponse>;
}

/**
 * Call the OpenAI chat-completions API via the Rust bridge. Same return
 * shape as `callAnthropic` so the scanner fallback chain can swap providers
 * without per-provider response handling. Tauri-only — there is no dev
 * fallback because we don't ship an `/api/openai` route.
 */
export async function callOpenAI(opts: {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  messages: AnthropicMessage[];
  temperature?: number;
}): Promise<AnthropicResponse> {
  if (!isTauri()) throw new Error('callOpenAI requires Tauri runtime');
  return invoke<AnthropicResponse>('call_openai', {
    apiKey: opts.apiKey,
    model: opts.model ?? 'gpt-4o',
    maxTokens: opts.maxTokens ?? 4096,
    messages: opts.messages,
    temperature: opts.temperature ?? null,
  });
}

/**
 * Generic OpenAI-compatible chat-completions call (DeepSeek, Grok, Kimi,
 * OpenRouter, Perplexity, Together, Zhipu, Qwen…). The `baseUrl` is
 * whatever the provider published — the Rust side appends `/chat/completions`.
 */
export async function callOpenAICompatible(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens?: number;
  messages: AnthropicMessage[];
  temperature?: number;
}): Promise<AnthropicResponse> {
  if (!isTauri()) throw new Error('callOpenAICompatible requires Tauri runtime');
  return invoke<AnthropicResponse>('call_openai_compatible', {
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    model: opts.model,
    maxTokens: opts.maxTokens ?? 4096,
    messages: opts.messages,
    temperature: opts.temperature ?? null,
  });
}

/**
 * Call Google's Gemini generateContent API via the Rust bridge. Tauri-only.
 * Same response shape as the other two providers.
 */
export async function callGemini(opts: {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  messages: AnthropicMessage[];
  temperature?: number;
}): Promise<AnthropicResponse> {
  if (!isTauri()) throw new Error('callGemini requires Tauri runtime');
  return invoke<AnthropicResponse>('call_gemini', {
    apiKey: opts.apiKey,
    model: opts.model ?? 'gemini-1.5-pro-latest',
    maxTokens: opts.maxTokens ?? 4096,
    messages: opts.messages,
    temperature: opts.temperature ?? null,
  });
}

// ── Provider key validation ──────────────────────────────────────────────────

/**
 * Mirror of `ValidateProviderKeyResult` in src-tauri/src/lib.rs. `ok=false`
 * is a *business* failure (401, network unreachable, malformed JSON) — the
 * promise itself only rejects on harness-level errors (unknown apiKind,
 * missing baseUrl for openai-compatible).
 */
export interface ValidateProviderKeyResult {
  ok: boolean;
  models: string[];
  errorReason: string | null;
}

export type ProviderApiKind =
  | 'anthropic'
  | 'openai-compatible'
  | 'gemini'
  | 'github';

/**
 * Validate a *just-typed* key by hitting the provider's list-models endpoint.
 * The renderer passes the raw key in; Rust pings the endpoint, returns
 * `{ ok, models, errorReason }`, and does **not** persist anything. Caller
 * is responsible for storing the key via `setSecret` only when `ok === true`.
 *
 * `baseUrl` is required when `apiKind === 'openai-compatible'` and ignored
 * for the other kinds.
 */
export async function validateProviderKey(opts: {
  apiKind: ProviderApiKind;
  apiKey: string;
  baseUrl?: string;
}): Promise<ValidateProviderKeyResult> {
  if (!isTauri()) {
    const res = await fetch('/api/keys/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiKind: opts.apiKind,
        baseUrl: opts.baseUrl ?? null,
        apiKey: opts.apiKey,
      }),
    });
    const body = (await res.json().catch(() => null)) as
      | ValidateProviderKeyResult
      | { error?: string }
      | null;
    if (!res.ok) {
      throw new Error(body && 'error' in body && body.error ? body.error : `Validation failed: ${res.status}`);
    }
    return body as ValidateProviderKeyResult;
  }
  return invoke<ValidateProviderKeyResult>('validate_provider_key', {
    apiKind: opts.apiKind,
    baseUrl: opts.baseUrl ?? null,
    apiKey: opts.apiKey,
  });
}

/**
 * Re-validate a key already stored in the keychain.  Rust reads the secret
 * from keyring itself — the key never leaves Rust, so this is the strictest
 * ADR-004 path. Use this for the Keys page's "Re-validate" button.
 *
 * Returns `{ ok: false, errorReason: 'No key configured' }` when the
 * keychain entry is missing (normal state, not an error).
 */
export async function revalidateProviderKey(opts: {
  keychainService: string;
  keychainKey: string;
  apiKind: ProviderApiKind;
  baseUrl?: string;
}): Promise<ValidateProviderKeyResult> {
  if (!isTauri()) {
    throw new Error('revalidateProviderKey requires Tauri runtime');
  }
  return invoke<ValidateProviderKeyResult>('revalidate_provider_key', {
    keychainService: opts.keychainService,
    keychainKey: opts.keychainKey,
    apiKind: opts.apiKind,
    baseUrl: opts.baseUrl ?? null,
  });
}

// ── Multi-provider fallback call ─────────────────────────────────────────────

export interface LlmFallbackAttempt {
  providerId: string;
  modelId: string;
  outcome: 'success' | 'failed';
  error?: string;
}

export interface LlmFallbackResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  usedProviderId: string;
  usedModelId: string;
  attempts: LlmFallbackAttempt[];
}

/**
 * Returns true when the error string indicates the model ID does not exist at
 * the provider — as opposed to a transient failure (rate limit, network, auth).
 * Pattern-matched against the Rust command's error string.
 *
 * Exported so other modules (e.g. the AI scanner) can apply the same
 * classification without duplicating the pattern list.
 */
export function isModelNotFoundError(err: string): boolean {
  const s = err.toLowerCase();
  return (
    s.includes('model_not_found') ||
    s.includes('model not found') ||
    s.includes('no such model') ||
    s.includes('does not exist') ||
    s.includes('unknown model') ||
    s.includes('invalid model') ||
    s.includes('not_found') ||
    // Gemini returns HTTP 404 for unknown model IDs
    (s.includes('404') && (s.includes('model') || s.includes('not found')))
  );
}

/**
 * Call a single provider+model via the appropriate Tauri command.
 * Extracted so both the primary attempt and the same-provider tier attempt
 * can share the same dispatch logic.
 */
async function callOneModel(
  spec: Awaited<ReturnType<typeof import('../keys/llmProviders').getLlmProvider>>,
  apiKey: string,
  modelId: string,
  opts: { messages: AnthropicMessage[]; maxTokens?: number; temperature?: number },
): Promise<AnthropicResponse> {
  if (!spec) throw new Error('Unknown provider');
  if (spec.apiKind === 'anthropic') {
    return callAnthropic({ apiKey, model: modelId, maxTokens: opts.maxTokens, messages: opts.messages, temperature: opts.temperature });
  }
  if (spec.apiKind === 'gemini') {
    return callGemini({ apiKey, model: modelId, maxTokens: opts.maxTokens, messages: opts.messages, temperature: opts.temperature });
  }
  return callOpenAICompatible({ apiKey, baseUrl: spec.baseUrl!, model: modelId, maxTokens: opts.maxTokens, messages: opts.messages, temperature: opts.temperature });
}

/**
 * Try `primary` first; on failure walk `fallbacks` in order.
 * Returns on the first successful response with a full attempt log.
 * Throws only when every entry in the chain has been exhausted.
 *
 * Fallback strategy per entry:
 *   1. Try the entry's model.
 *   2. If it fails with a "model not found" error → try the provider's one-tier-
 *      down `tierModel` (if defined and different from the entry model).
 *   3. Transient errors (rate limit, network, auth) skip the tier attempt and
 *      move immediately to the next chain entry.
 *
 * Applies to direct LLM API calls only — CLI agent spawns (spawn_agent) bake
 * the primary model into the command args and do not use this fallback.
 */
export async function callLlmWithFallback(opts: {
  primary: { providerId: string; modelId: string };
  fallbacks?: Array<{ providerId: string; modelId: string }>;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<LlmFallbackResult> {
  if (!isTauri()) throw new Error('callLlmWithFallback requires Tauri runtime');

  const { getLlmProvider } = await import('../keys/llmProviders');
  const chain = [opts.primary, ...(opts.fallbacks ?? [])];
  const attempts: LlmFallbackAttempt[] = [];

  for (const entry of chain) {
    const spec = getLlmProvider(entry.providerId as Parameters<typeof getLlmProvider>[0]);
    if (!spec) {
      attempts.push({ providerId: entry.providerId, modelId: entry.modelId, outcome: 'failed', error: 'Unknown provider' });
      continue;
    }

    let apiKey: string | null = null;
    try {
      apiKey = await getSecret('project-manager', spec.keychainKey);
    } catch { /* key might not exist */ }
    if (!apiKey) {
      attempts.push({ providerId: entry.providerId, modelId: entry.modelId, outcome: 'failed', error: 'No API key stored' });
      continue;
    }

    // ── Attempt 1: primary model for this entry ──────────────────────────────
    try {
      const res = await callOneModel(spec, apiKey, entry.modelId, opts);
      attempts.push({ providerId: entry.providerId, modelId: entry.modelId, outcome: 'success' });
      return { ...res, usedProviderId: entry.providerId, usedModelId: entry.modelId, attempts };
    } catch (err) {
      const errStr = String(err);
      attempts.push({ providerId: entry.providerId, modelId: entry.modelId, outcome: 'failed', error: errStr });

      // Transient error → skip tier attempt, try next provider
      if (!isModelNotFoundError(errStr)) continue;
    }

    // ── Attempt 2: same-provider tier model (model-not-found only) ───────────
    const tier = spec.tierModel;
    if (!tier || tier === entry.modelId) continue;

    try {
      const res = await callOneModel(spec, apiKey, tier, opts);
      attempts.push({ providerId: entry.providerId, modelId: tier, outcome: 'success' });
      return { ...res, usedProviderId: entry.providerId, usedModelId: tier, attempts };
    } catch (err) {
      attempts.push({ providerId: entry.providerId, modelId: tier, outcome: 'failed', error: String(err) });
      // tier also failed → fall through to next chain entry
    }
  }

  const summary = attempts.map((a) => `${a.providerId}/${a.modelId}: ${a.error ?? 'failed'}`).join('; ');
  throw new Error(`All models in fallback chain failed — ${summary}`);
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentSession {
  id: string;
  title: string;
  projectId?: string;
  featureId?: string;
  agentId?: string;
  model: string;
  messages: SessionMessage[];
  startedAt: string;
  completedAt?: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  status: 'active' | 'completed' | 'error';
  tags?: string[];
}

/** List all sessions under `sessionsDir`, sorted newest-first. No-op in browser (returns []). */
export async function listSessions(sessionsDir: string): Promise<AgentSession[]> {
  if (!isTauri()) return [];
  return invoke<AgentSession[]>('list_sessions', { sessionsDir });
}

/** Read a full session by ID. Tauri only. */
export async function readSession(sessionsDir: string, sessionId: string): Promise<AgentSession> {
  if (!isTauri()) throw new Error('readSession requires Tauri runtime');
  return invoke<AgentSession>('read_session', { sessionsDir, sessionId });
}

/** Persist a session to disk. Tauri only; silently no-ops in browser. */
export async function saveSession(sessionsDir: string, session: AgentSession): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('save_session', { sessionsDir, session });
}

// ── Generic file read ─────────────────────────────────────────────────────────

/**
 * Read a plain-text file from disk and return its content.
 * In Tauri mode uses the Rust bridge; in browser dev mode uses
 * the /api/editor/read-file Next.js route.
 */
export async function readFile(path: string): Promise<string> {
  if (isTauri()) {
    return invoke<string>('read_file', { path });
  }
  // Browser dev mode: proxy through Next.js API route
  if (typeof window === 'undefined') return '';
  const res = await fetch('/api/editor/read-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Read failed (${res.status})` }));
    throw new Error(err.error ?? `Read failed (${res.status})`);
  }
  const data = await res.json();
  return data.content ?? '';
}

// ── .env discovery (Keys view bulk import) ────────────────────────────────────

export interface EnvFileInfo {
  path: string;
  name: string;
  content: string;
}

/**
 * Scan a project's top-level directory for dotenv-style files (.env, .env.local,
 * .envrc, …) and return each with its content preloaded.  Files larger than
 * 256 KB are skipped on the Rust side. Returns `[]` outside Tauri (no FS).
 */
export async function scanEnvFiles(root: string): Promise<EnvFileInfo[]> {
  if (!isTauri()) {
    const res = await fetch('/api/keys/scan-env-files', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ root }),
    });
    const body = (await res.json().catch(() => null)) as
      | { files?: EnvFileInfo[]; error?: string }
      | null;
    if (!res.ok) {
      throw new Error(body?.error ?? `Cannot scan .env files: ${res.status}`);
    }
    return body?.files ?? [];
  }
  return invoke<EnvFileInfo[]>('scan_env_files', { root });
}

// ── GitHub OAuth Device Flow ──────────────────────────────────────────────────

export interface GithubDeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

interface RawDeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export type GithubDevicePollResult =
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'expired' }
  | { status: 'access_denied' }
  | { status: 'authorized'; access_token: string };

/**
 * Kick off the GitHub OAuth Device Flow. Returns a user code the renderer
 * displays + a verification URL to open in the browser. Throws with
 * `OAUTH_NOT_CONFIGURED` when `PM_GITHUB_OAUTH_CLIENT_ID` is unset.
 */
export async function githubOAuthDeviceStart(scopes: string[]): Promise<GithubDeviceCode> {
  if (!isTauri()) throw new Error('githubOAuthDeviceStart requires Tauri runtime');
  const raw = await invoke<RawDeviceCode>('github_oauth_device_start', {
    scopes: scopes.join(' '),
  });
  return {
    deviceCode: raw.device_code,
    userCode: raw.user_code,
    verificationUri: raw.verification_uri,
    expiresIn: raw.expires_in,
    interval: raw.interval,
  };
}

/** Poll the token endpoint once. Caller is responsible for the interval loop. */
export async function githubOAuthDevicePoll(deviceCode: string): Promise<GithubDevicePollResult> {
  if (!isTauri()) throw new Error('githubOAuthDevicePoll requires Tauri runtime');
  return invoke<GithubDevicePollResult>('github_oauth_device_poll', { deviceCode });
}

// ── Project file tree ─────────────────────────────────────────────────────────

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileNode[];
}

/**
 * Recursively list files and directories under `root` up to `maxDepth` levels.
 * Common build/cache folders (.git, node_modules, target, .next, …) are pruned.
 * Tauri only — throws in browser dev mode.
 */
export async function listProjectFiles(root: string, maxDepth = 4): Promise<FileNode[]> {
  if (!isTauri()) throw new Error('listProjectFiles requires Tauri runtime');
  return invoke<FileNode[]>('list_project_files', { root, maxDepth });
}

// ── Telegram polling (Channels Phase 2) ──────────────────────────────────────

export type TelegramPollPhase =
  | { phase: 'polling' }
  | { phase: 'stopped' }
  | { phase: 'errored'; message: string };

export interface TelegramPollStatus {
  channelId: string;
  status: TelegramPollPhase;
  startedAt?: string;
  lastUpdateAt?: string;
}

export interface TelegramMessagePayload {
  channelId: string;
  updateId: number;
  messageId: number;
  chatId: number;
  fromId: number;
  fromUsername?: string;
  fromName?: string;
  text: string;
  timestamp: string;
}

/**
 * Start a long-poll loop for a Telegram channel. Idempotent — if the channel
 * is already polling, the existing loop is stopped first so new credentials
 * take effect. Pass an empty `allowedChatIds` to disable the gate (not
 * recommended — anyone who finds the bot can issue commands).
 */
export async function telegramStartPoll(opts: {
  channelId: string;
  botToken: string;
  allowedChatIds: number[];
}): Promise<TelegramPollStatus> {
  if (!isTauri()) throw new Error('telegramStartPoll requires Tauri runtime');
  return invoke<TelegramPollStatus>('telegram_start_poll', {
    channelId: opts.channelId,
    botToken: opts.botToken,
    allowedChatIds: opts.allowedChatIds,
  });
}

/** Signal the long-poll loop for `channelId` to terminate. No-op if idle. */
export async function telegramStopPoll(channelId: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('telegram_stop_poll', { channelId });
}

/** All channels PM currently tracks. Channels never started are absent. */
export async function telegramStatusAll(): Promise<TelegramPollStatus[]> {
  if (!isTauri()) return [];
  return invoke<TelegramPollStatus[]>('telegram_status_all');
}

/** POST a text reply to a Telegram chat. */
export async function telegramSendMessage(
  botToken: string,
  chatId: number,
  text: string,
): Promise<void> {
  if (!isTauri()) throw new Error('telegramSendMessage requires Tauri runtime');
  return invoke<void>('telegram_send_message', { botToken, chatId, text });
}

export interface TelegramBotInfo {
  id: number;
  isBot: boolean;
  firstName: string;
  username?: string;
  canJoinGroups: boolean;
  canReadAllGroupMessages: boolean;
  supportsInlineQueries: boolean;
}

/**
 * Validate a Telegram Bot Token against the `getMe` endpoint. Returns bot
 * identity on success. The Rust side scrubs the token from error messages, so
 * caller can safely surface the rejected reason to the UI.
 */
export async function telegramGetMe(botToken: string): Promise<TelegramBotInfo> {
  if (!isTauri()) throw new Error('telegramGetMe requires Tauri runtime');
  return invoke<TelegramBotInfo>('telegram_get_me', { botToken });
}

export function onTelegramMessage(cb: (p: TelegramMessagePayload) => void): Promise<UnlistenFn> {
  return listen<TelegramMessagePayload>('telegram-message', cb);
}

export function onTelegramStatus(cb: (p: TelegramPollStatus) => void): Promise<UnlistenFn> {
  return listen<TelegramPollStatus>('telegram-status', cb);
}

// ── App update check ──────────────────────────────────────────────────────────

export interface UpdateCheckResult {
  current: string;
  hasUpdate: boolean;
  latest?: string;
}

/**
 * Query the current app version and optionally the latest GitHub release.
 * Only available inside the Tauri runtime — throws in browser / next dev.
 * The Rust side never throws on network errors; it returns `hasUpdate: false`
 * so the UI always gets a usable result.
 */
export async function checkUpdate(): Promise<UpdateCheckResult> {
  if (!isTauri()) throw new Error('checkUpdate requires Tauri runtime');
  const raw = await invoke<{ current: string; has_update: boolean; latest?: string }>(
    'check_update',
  );
  return {
    current: raw.current,
    hasUpdate: raw.has_update,
    latest: raw.latest,
  };
}
