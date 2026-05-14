/**
 * Bridge module — wraps Tauri IPC commands.
 *
 * All runtime OS operations (FS read/write, process spawn/kill) go through
 * this module. In development (browser), it falls back to the legacy
 * /api/bridge/execute HTTP route so the Next.js dev server still works.
 */

import { migrateConfig } from '../storage';
import type { ProjectManagerConfig } from '../types';

// ── Tauri detection ───────────────────────────────────────────────────────────

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(command, args);
}

// ── Config operations ─────────────────────────────────────────────────────────

export async function readConfig(path: string): Promise<ProjectManagerConfig> {
  if (!isTauri()) throw new Error('readConfig requires Tauri runtime');
  // Pipe through schema migration so older v1 files on disk are transparently
  // upgraded — the in-memory shape is always current (ADR-006).
  const raw = await invoke<unknown>('read_config', { path });
  return migrateConfig(raw);
}

export async function writeConfig(path: string, config: ProjectManagerConfig): Promise<void> {
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

// ── GitHub token (Keychain in Tauri, localStorage fallback in dev) ───────────

const GITHUB_TOKEN_SERVICE = 'projectmanager';
const GITHUB_TOKEN_KEY = 'github-token';
const GITHUB_TOKEN_LS_FALLBACK = 'projectManager-github-token';

/**
 * Read the user's GitHub token.  Lives in the OS Keychain under Tauri (so it
 * never reaches the renderer until requested), and falls back to localStorage
 * in `next dev` mode where Keychain isn't available.
 */
export async function getGithubToken(): Promise<string> {
  if (isTauri()) {
    const v = await getSecret(GITHUB_TOKEN_SERVICE, GITHUB_TOKEN_KEY);
    return v ?? '';
  }
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(GITHUB_TOKEN_LS_FALLBACK) ?? '';
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
    window.localStorage.setItem(GITHUB_TOKEN_LS_FALLBACK, value);
  } catch {
    /* ignore */
  }
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
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<AnthropicResponse>;
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
 * Returns an empty string in browser dev mode (no Tauri runtime).
 */
export async function readFile(path: string): Promise<string> {
  if (!isTauri()) return '';
  return invoke<string>('read_file', { path });
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
