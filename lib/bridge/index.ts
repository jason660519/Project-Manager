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
