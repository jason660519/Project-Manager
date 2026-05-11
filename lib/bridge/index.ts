/**
 * Bridge module — wraps Tauri IPC commands.
 *
 * All runtime OS operations (FS read/write, process spawn/kill) go through
 * this module. In development (browser), it falls back to the legacy
 * /api/bridge/execute HTTP route so the Next.js dev server still works.
 */

import type { DevPilotConfig } from '../types';

// ── Tauri detection ───────────────────────────────────────────────────────────

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(command, args);
}

// ── Config operations ─────────────────────────────────────────────────────────

export async function readConfig(path: string): Promise<DevPilotConfig> {
  if (!isTauri()) throw new Error('readConfig requires Tauri runtime');
  return invoke<DevPilotConfig>('read_config', { path });
}

export async function writeConfig(path: string, config: DevPilotConfig): Promise<void> {
  if (!isTauri()) throw new Error('writeConfig requires Tauri runtime');
  return invoke<void>('write_config', { path, config });
}

export async function scanProjects(root: string): Promise<string[]> {
  if (!isTauri()) throw new Error('scanProjects requires Tauri runtime');
  return invoke<string[]>('scan_projects', { root });
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

export type ConfigChangedPayload = { path: string; config: DevPilotConfig };

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
  if (!isTauri()) throw new Error('fetchGithubRepo requires Tauri runtime');
  return invoke<GitHubFeature[]>('fetch_github_repo', { token, repoUrl });
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

// ── OS Keychain ───────────────────────────────────────────────────────────────

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

// ── Anthropic API (via Rust — key never touches renderer) ────────────────────

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
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
}): Promise<AnthropicResponse> {
  if (!isTauri()) {
    throw new Error('callAnthropic requires Tauri runtime (API key must not be sent from browser)');
  }
  return invoke<AnthropicResponse>('call_anthropic', {
    apiKey: opts.apiKey,
    model: opts.model ?? 'claude-sonnet-4-6',
    maxTokens: opts.maxTokens ?? 4096,
    messages: opts.messages,
  });
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
