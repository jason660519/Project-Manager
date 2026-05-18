'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Globe,
  Monitor,
  Play,
  Plus,
  Power,
  RotateCw,
  Trash2,
} from 'lucide-react';

import type {
  AnyPlugin,
  CliPlugin,
  EditorPlugin,
  McpPlugin,
  PluginCatalog,
  PluginKind,
  ProviderPlugin,
} from '../../../lib/types/plugins';
import {
  addPlugin,
  loadAllApiKeys,
  loadPluginCatalog,
  removePlugin,
  savePluginCatalog,
  selectProviders,
  setProviderApiKey,
  togglePluginEnabled,
  updatePlugin,
} from '../../../lib/storage/plugins';
import {
  type McpRunStatus,
  type SkillFileInfo,
  type UnlistenFn,
  mcpKill,
  mcpLogs,
  mcpLogsDir,
  mcpSpawn,
  mcpStatusAll,
  onMcpLog,
  onMcpStatus,
  openPath,
  skillInstallFromUrl,
  skillList,
  skillUninstall,
} from '../../../lib/bridge';
import { getSkillsDir } from '../../../lib/storage/settings';

// ─── Static marketplace catalog ────────────────────────────────────────────────

type Category = 'ai' | 'dev' | 'vcs' | 'pm' | 'ci' | 'notify';
type MarketplaceKind = 'provider' | 'cli' | 'editor' | 'mcp';

type ProviderDefaults = Pick<ProviderPlugin, 'baseUrl' | 'defaultModel' | 'models'>;
type CliDefaults = Pick<CliPlugin, 'command' | 'argsTemplate' | 'providerId'>;
type EditorDefaults = Pick<EditorPlugin, 'command'>;
type McpDefaults = Pick<McpPlugin, 'transport' | 'command' | 'args' | 'env' | 'url' | 'headers'>;

interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  category: Category;
  kind: MarketplaceKind;
  accentColor: string;
  initials: string;
  defaultProvider?: ProviderDefaults;
  defaultCli?: CliDefaults;
  defaultEditor?: EditorDefaults;
  defaultMcp?: McpDefaults;
}

const MARKETPLACE: MarketplacePlugin[] = [
  // AI Providers
  {
    id: 'anthropic', name: 'Anthropic', description: 'Access Claude models including Opus, Sonnet, and Haiku.',
    category: 'ai', kind: 'provider', accentColor: 'bg-[#c47a3a]', initials: 'AN',
    defaultProvider: { baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-6', models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
  },
  {
    id: 'openai', name: 'OpenAI', description: 'GPT-4o, o1, o3-mini and other OpenAI models.',
    category: 'ai', kind: 'provider', accentColor: 'bg-[#10a37f]', initials: 'OA',
    defaultProvider: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'] },
  },
  {
    id: 'google', name: 'Google Gemini', description: 'Gemini 2.5 Pro, Flash and Gemini 1.5 models.',
    category: 'ai', kind: 'provider', accentColor: 'bg-[#4285f4]', initials: 'GG',
    defaultProvider: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.0-flash', models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'] },
  },
  {
    id: 'ollama', name: 'Ollama', description: 'Run Llama, Mistral, and other models locally on your machine.',
    category: 'ai', kind: 'provider', accentColor: 'bg-stone-600', initials: 'OL',
    defaultProvider: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3', models: ['llama3', 'llama3:70b', 'mistral', 'codellama'] },
  },
  // Code CLIs
  {
    id: 'claude-code', name: 'Claude Code', description: 'Agentic CLI for software engineering tasks.',
    category: 'dev', kind: 'cli', accentColor: 'bg-[#c47a3a]', initials: 'CC',
    defaultCli: { command: 'claude', argsTemplate: ['--cwd', '{root}', '{prompt}'], providerId: 'anthropic' },
  },
  {
    id: 'codex', name: 'Codex CLI', description: 'OpenAI Codex command-line agent for code tasks.',
    category: 'dev', kind: 'cli', accentColor: 'bg-[#10a37f]', initials: 'CX',
    defaultCli: { command: 'codex', argsTemplate: ['exec', '--cwd', '{root}', '{prompt}'], providerId: 'openai' },
  },
  {
    id: 'hermes-agent', name: 'Hermes Agent', description: 'Project-scoped Hermes CLI with isolated memory, sessions, skills, and dashboard state.',
    category: 'dev', kind: 'cli', accentColor: 'bg-amber-700', initials: 'HA',
    defaultCli: { command: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/bin/hermes', argsTemplate: ['chat', '-q', '{prompt}'] },
  },
  {
    id: 'openclaw', name: 'OpenClaw', description: 'Project-scoped OpenClaw gateway and agent CLI with isolated state, workspace, updates, and rollback.',
    category: 'dev', kind: 'cli', accentColor: 'bg-rose-700', initials: 'OC',
    defaultCli: { command: '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager/bin/openclaw', argsTemplate: ['agent', '--message', '{prompt}'] },
  },
  {
    id: 'aider', name: 'Aider', description: 'AI pair programmer that edits code in your terminal.',
    category: 'dev', kind: 'cli', accentColor: 'bg-violet-700', initials: 'AD',
    defaultCli: { command: 'aider', argsTemplate: ['--yes', '--message', '{prompt}'] },
  },
  // Editors
  {
    id: 'cursor', name: 'Cursor', description: 'AI-first code editor built on VS Code.',
    category: 'dev', kind: 'editor', accentColor: 'bg-[#6b6cf6]', initials: 'CR',
    defaultEditor: { command: 'cursor' },
  },
  {
    id: 'vscode', name: 'VS Code', description: 'Microsoft Visual Studio Code editor.',
    category: 'dev', kind: 'editor', accentColor: 'bg-[#007acc]', initials: 'VS',
    defaultEditor: { command: 'code' },
  },
  {
    id: 'zed', name: 'Zed', description: 'High-performance multiplayer code editor.',
    category: 'dev', kind: 'editor', accentColor: 'bg-[#084ccd]', initials: 'ZD',
    defaultEditor: { command: 'zed' },
  },
  {
    id: 'trae', name: 'Trae', description: 'ByteDance AI-native code editor.',
    category: 'dev', kind: 'editor', accentColor: 'bg-[#1a6b5c]', initials: 'TR',
    defaultEditor: { command: 'trae' },
  },
  {
    id: 'antigravity', name: 'Antigravity', description: 'Antigravity AI-native IDE.',
    category: 'dev', kind: 'editor', accentColor: 'bg-[#2b2540]', initials: 'AG',
    defaultEditor: { command: 'antigravity' },
  },
  // MCP servers
  {
    id: 'mcp-filesystem', name: 'Filesystem MCP', description: 'Read and edit local files via the Model Context Protocol.',
    category: 'dev', kind: 'mcp', accentColor: 'bg-violet-700', initials: 'FS',
    defaultMcp: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '{root}'] },
  },
  {
    id: 'mcp-chrome', name: 'Chrome MCP', description: 'Drive a Chrome browser so the AI can navigate, click, and read pages.',
    category: 'dev', kind: 'mcp', accentColor: 'bg-[#4285f4]', initials: 'CM',
    defaultMcp: { transport: 'stdio', command: 'npx', args: ['-y', 'chrome-mcp-server'] },
  },
  {
    id: 'mcp-slack', name: 'Slack MCP', description: 'Post messages and read channels via the Slack MCP server.',
    category: 'notify', kind: 'mcp', accentColor: 'bg-[#4a154b]', initials: 'SM',
    defaultMcp: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'], env: { SLACK_BOT_TOKEN: '' } },
  },
  // Future integrations (placeholder — kept as CLIs for back-compat; future phases may reclassify as MCP)
  {
    id: 'github', name: 'GitHub', description: 'Sync pull requests and issues to your projects.',
    category: 'vcs', kind: 'cli', accentColor: 'bg-stone-700', initials: 'GH',
    defaultCli: { command: 'gh', argsTemplate: [] },
  },
  {
    id: 'linear', name: 'Linear', description: 'Pull issues and cycles into Project Manager features.',
    category: 'pm', kind: 'cli', accentColor: 'bg-[#5e6ad2]', initials: 'LN',
    defaultCli: { command: 'linear', argsTemplate: [] },
  },
  {
    id: 'slack', name: 'Slack (CLI)', description: 'Slack CLI launcher (legacy — prefer the Slack MCP entry).',
    category: 'notify', kind: 'cli', accentColor: 'bg-[#4a154b]', initials: 'SL',
    defaultCli: { command: 'slack', argsTemplate: [] },
  },
  {
    id: 'sentry', name: 'Sentry', description: 'Import recent errors as engineering tasks.',
    category: 'ci', kind: 'cli', accentColor: 'bg-[#fb4226]', initials: 'SE',
    defaultCli: { command: 'sentry', argsTemplate: [] },
  },
];

const CATEGORIES: { id: 'all' | Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ai', label: 'AI Providers' },
  { id: 'dev', label: 'Dev Tools' },
  { id: 'vcs', label: 'Version Control' },
  { id: 'pm', label: 'Project Mgmt' },
  { id: 'ci', label: 'Monitoring' },
  { id: 'notify', label: 'Notifications' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInstalledIds(catalog: PluginCatalog): Set<string> {
  return new Set(catalog.plugins.map((p) => p.id));
}

function kindLabel(kind: PluginKind) {
  switch (kind) {
    case 'provider': return { text: 'Provider', cls: 'text-emerald-300 border-emerald-200/25' };
    case 'cli':      return { text: 'CLI',      cls: 'text-cyan-300 border-cyan-200/25' };
    case 'editor':   return { text: 'Editor',   cls: 'text-amber-300 border-amber-200/25' };
    case 'mcp':      return { text: 'MCP',      cls: 'text-violet-300 border-violet-200/25' };
    case 'skill':    return { text: 'Skill',    cls: 'text-fuchsia-300 border-fuchsia-200/25' };
  }
}

function kindIcon(kind: PluginKind) {
  if (kind === 'provider') return Globe;
  if (kind === 'cli' || kind === 'mcp') return Bot;
  return Monitor;
}

function marketplaceFor(id: string): MarketplacePlugin | undefined {
  return MARKETPLACE.find((m) => m.id === id);
}

// ─── Shared atoms ──────────────────────────────────────────────────────────────

function PluginLogo({ initials, accentColor, size = 'md' }: { initials: string; accentColor: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs';
  return (
    <div className={`flex shrink-0 items-center justify-center font-bold text-white/90 ${dim} ${accentColor}`}>
      {initials}
    </div>
  );
}

function FallbackLogo({ kind, size = 'md' }: { kind: PluginKind; size?: 'sm' | 'md' }) {
  const Icon = kindIcon(kind);
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <div className={`flex shrink-0 items-center justify-center bg-stone-800 ${dim}`}>
      <Icon size={size === 'sm' ? 14 : 16} className="text-stone-400" />
    </div>
  );
}

function McpStatusPill({ status }: { status?: McpRunStatus }) {
  if (!status) {
    return <span className="border border-stone-700 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-stone-500">Idle</span>;
  }
  if (status.phase === 'running') {
    return <span className="border border-emerald-400/40 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-emerald-300">Running · PID {status.pid}</span>;
  }
  if (status.phase === 'stopped') {
    return <span className="border border-stone-500/40 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-stone-400">Stopped</span>;
  }
  return (
    <span title={status.message} className="border border-red-500/40 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-red-400">
      Errored
    </span>
  );
}

const inputCls =
  'w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35 placeholder:text-stone-600';

// ─── Configure forms ───────────────────────────────────────────────────────────

function ProviderConfigForm({
  entry,
  initialApiKey,
  onSave,
  onCancel,
}: {
  entry: ProviderPlugin;
  initialApiKey: string;
  onSave: (p: ProviderPlugin, key: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    baseUrl: entry.baseUrl,
    defaultModel: entry.defaultModel,
    models: entry.models.join('\n'),
    apiKey: initialApiKey,
    showKey: false,
  });
  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-3 border-t border-stone-200/12 bg-[#061512]/60 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Base URL</label>
          <input value={form.baseUrl} onChange={set('baseUrl')} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Default Model</label>
          <input value={form.defaultModel} onChange={set('defaultModel')} className={inputCls} />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">API Key</label>
          <div className="relative">
            <input
              type={form.showKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={set('apiKey')}
              placeholder="sk-ant-..."
              className={`${inputCls} pr-9`}
            />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, showKey: !f.showKey }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-200"
            >
              {form.showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
        <div className="col-span-2 space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Models (one per line)</label>
          <textarea rows={3} value={form.models} onChange={set('models')} className={`${inputCls} font-mono text-xs`} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100">Cancel</button>
        <button
          onClick={() =>
            onSave(
              { ...entry, baseUrl: form.baseUrl, defaultModel: form.defaultModel, models: form.models.split('\n').map((s) => s.trim()).filter(Boolean) },
              form.apiKey,
            )
          }
          className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[#071d1a] hover:bg-amber-100"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function CliConfigForm({
  entry,
  providers,
  onSave,
  onCancel,
}: {
  entry: CliPlugin;
  providers: ProviderPlugin[];
  onSave: (a: CliPlugin) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    command: entry.command,
    argsTemplate: entry.argsTemplate.join('\n'),
    providerId: entry.providerId ?? '',
  });
  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-3 border-t border-stone-200/12 bg-[#061512]/60 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Command</label>
          <input value={form.command} onChange={set('command')} className={`${inputCls} font-mono`} />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Provider</label>
          <select value={form.providerId} onChange={set('providerId')} className={inputCls}>
            <option value="">— none —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">
            Args Template (one per line · use {'{prompt}'} {'{root}'} {'{featureId}'})
          </label>
          <textarea rows={3} value={form.argsTemplate} onChange={set('argsTemplate')} className={`${inputCls} font-mono text-xs`} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100">Cancel</button>
        <button
          onClick={() =>
            onSave({
              ...entry,
              command: form.command,
              argsTemplate: form.argsTemplate.split('\n').map((s) => s.trim()).filter(Boolean),
              providerId: form.providerId || undefined,
            })
          }
          className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[#071d1a] hover:bg-amber-100"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function EditorConfigForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: EditorPlugin;
  onSave: (editor: EditorPlugin) => void;
  onCancel: () => void;
}) {
  const [command, setCommand] = useState(entry.command);
  return (
    <div className="space-y-3 border-t border-stone-200/12 bg-[#061512]/60 p-4">
      <div className="space-y-1">
        <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Command</label>
        <input value={command} onChange={(e) => setCommand(e.target.value)} className={`${inputCls} font-mono`} />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100">Cancel</button>
        <button
          onClick={() => onSave({ ...entry, command })}
          className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[#071d1a] hover:bg-amber-100"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function McpConfigForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: McpPlugin;
  onSave: (m: McpPlugin) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    command: entry.command ?? '',
    args: (entry.args ?? []).join('\n'),
    env: Object.entries(entry.env ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join('\n'),
  });
  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    const envMap: Record<string, string> = {};
    form.env.split('\n').forEach((line) => {
      const idx = line.indexOf('=');
      if (idx <= 0) return;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k) envMap[k] = v;
    });
    onSave({
      ...entry,
      transport: 'stdio',
      command: form.command,
      args: form.args.split('\n').map((s) => s.trim()).filter(Boolean),
      env: Object.keys(envMap).length > 0 ? envMap : undefined,
    });
  };

  return (
    <div className="space-y-3 border-t border-stone-200/12 bg-[#061512]/60 p-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Command</label>
          <input value={form.command} onChange={set('command')} placeholder="npx" className={`${inputCls} font-mono`} />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Args (one per line)</label>
          <textarea rows={3} value={form.args} onChange={set('args')} className={`${inputCls} font-mono text-xs`} />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Env (KEY=VALUE per line)</label>
          <textarea
            rows={2}
            value={form.env}
            onChange={set('env')}
            placeholder="GITHUB_TOKEN=ghp_..."
            className={`${inputCls} font-mono text-xs`}
          />
        </div>
        <p className="text-[11px] text-stone-500">
          Transport is fixed to <span className="font-mono">stdio</span> in this version. HTTP transport will arrive in a later phase.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100">Cancel</button>
        <button onClick={handleSave} className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[#071d1a] hover:bg-amber-100">
          Save
        </button>
      </div>
    </div>
  );
}

// ─── MCP logs viewer ───────────────────────────────────────────────────────────

function McpLogsViewer({ pluginId, onClose }: { pluginId: string; onClose: () => void }) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;

    mcpLogs(pluginId, 500)
      .then((text) => {
        if (cancelled) return;
        setLines(text ? text.split('\n') : []);
      })
      .catch(() => {
        /* not in Tauri */
      });

    onMcpLog((p) => {
      if (p.pluginId !== pluginId) return;
      const formatted = `[${p.timestamp}] [${p.level}] ${p.line}`;
      setLines((prev) => (prev.length >= 2000 ? [...prev.slice(-1999), formatted] : [...prev, formatted]));
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        /* not in Tauri */
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [pluginId]);

  const handleOpenFolder = async () => {
    try {
      const dir = await mcpLogsDir();
      await openPath(dir);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to open logs dir', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden border border-stone-200/18 bg-[#071d1a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200/12 bg-white/[0.035] px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-stone-50">MCP Logs</h3>
            <p className="font-mono text-xs text-stone-400">{pluginId}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-stone-400 hover:text-stone-100">
            &times;
          </button>
        </div>
        <div className="max-h-[60vh] min-h-[300px] overflow-auto bg-[#03100f] p-3 font-mono text-xs leading-5 text-stone-200">
          {lines.length === 0 ? (
            <span className="text-stone-500">No log lines yet.</span>
          ) : (
            lines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))
          )}
        </div>
        <div className="flex justify-between gap-3 border-t border-stone-200/12 bg-white/[0.035] px-6 py-4">
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1.5 border border-stone-200/25 px-3 py-1.5 text-xs text-stone-300 hover:bg-white/5"
          >
            <FolderOpen size={12} /> Open log folder
          </button>
          <button onClick={onClose} className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[#071d1a] hover:bg-amber-100">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Installed tab ─────────────────────────────────────────────────────────────

type InstalledRow = ProviderPlugin | CliPlugin | EditorPlugin | McpPlugin;

function isInstalledRow(p: AnyPlugin): p is InstalledRow {
  return p.kind === 'provider' || p.kind === 'cli' || p.kind === 'editor' || p.kind === 'mcp';
}

interface McpControls {
  statuses: Map<string, McpRunStatus>;
  start: (plugin: McpPlugin) => void;
  stop: (id: string) => void;
  restart: (plugin: McpPlugin) => void;
  viewLogs: (id: string) => void;
}

function InstalledTab({
  catalog,
  apiKeys,
  mcpControls,
  onCatalogChange,
  onApiKeyChange,
}: {
  catalog: PluginCatalog;
  apiKeys: Record<string, string>;
  mcpControls: McpControls;
  onCatalogChange: (c: PluginCatalog) => void;
  onApiKeyChange: (id: string, key: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows: InstalledRow[] = catalog.plugins.filter(isInstalledRow);
  const providers = selectProviders(catalog);

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  const removeEntry = (id: string) => {
    if (expandedId === id) setExpandedId(null);
    onCatalogChange(removePlugin(catalog, id));
  };

  const toggleEnabled = (id: string) => {
    onCatalogChange(togglePluginEnabled(catalog, id));
  };

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 text-stone-600">
          <Plus size={28} />
        </div>
        <p className="text-sm text-stone-500">No plugins installed yet.</p>
        <p className="mt-1 text-xs text-stone-600">Browse the Marketplace tab to add your first plugin.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-stone-200/10 border border-stone-200/18 bg-[#071d1a]/72">
      {rows.map((row) => {
        const id = row.id;
        const mp = marketplaceFor(id);
        const isExpanded = expandedId === id;
        const enabled = row.enabled;
        const badge = kindLabel(row.kind);
        const mcpStatus = row.kind === 'mcp' ? mcpControls.statuses.get(id) : undefined;
        const isRunning = mcpStatus?.phase === 'running';

        return (
          <div key={id}>
            <div className="flex items-center gap-3 px-4 py-3">
              {mp ? (
                <PluginLogo initials={mp.initials} accentColor={mp.accentColor} size="sm" />
              ) : (
                <FallbackLogo kind={row.kind} size="sm" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium ${enabled ? 'text-stone-100' : 'text-stone-500'}`}>{row.name}</span>
                  <span className={`border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${badge.cls}`}>{badge.text}</span>
                  {row.kind === 'provider' && apiKeys[id] && (
                    <span className="border border-emerald-200/25 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-emerald-300/80">key set</span>
                  )}
                  {row.kind === 'mcp' && <McpStatusPill status={mcpStatus} />}
                </div>
                <p className="mt-0.5 truncate font-mono text-[11px] text-stone-500">
                  {row.kind === 'provider'
                    ? row.baseUrl
                    : row.kind === 'mcp'
                      ? [row.command, ...(row.args ?? [])].filter(Boolean).join(' ') || '(unconfigured)'
                      : row.command}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* MCP-only lifecycle controls */}
                {row.kind === 'mcp' && (
                  <>
                    {isRunning ? (
                      <>
                        <button
                          onClick={() => mcpControls.restart(row)}
                          title="Restart"
                          className="border border-stone-200/18 px-1.5 py-1 text-stone-400 hover:border-stone-200/35 hover:text-stone-100"
                        >
                          <RotateCw size={12} />
                        </button>
                        <button
                          onClick={() => mcpControls.stop(id)}
                          title="Stop"
                          className="border border-stone-200/18 px-1.5 py-1 text-stone-400 hover:border-red-500/30 hover:text-red-400"
                        >
                          <Power size={12} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => mcpControls.start(row)}
                        title="Start"
                        className="border border-stone-200/18 px-1.5 py-1 text-stone-400 hover:border-emerald-400/40 hover:text-emerald-300"
                      >
                        <Play size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => mcpControls.viewLogs(id)}
                      title="View logs"
                      className="border border-stone-200/18 px-1.5 py-1 text-stone-400 hover:border-stone-200/35 hover:text-stone-100"
                    >
                      <FileText size={12} />
                    </button>
                  </>
                )}

                {/* Enable toggle */}
                <button
                  onClick={() => toggleEnabled(id)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? 'bg-emerald-600' : 'bg-stone-700'}`}
                  title={enabled ? 'Disable' : 'Enable'}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>

                {/* Configure */}
                <button
                  onClick={() => toggleExpand(id)}
                  className="flex items-center gap-1 border border-stone-200/18 px-2 py-1 text-xs text-stone-400 hover:border-stone-200/35 hover:text-stone-100"
                >
                  Configure
                  {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>

                {/* Remove */}
                <button
                  onClick={() => removeEntry(id)}
                  className="border border-stone-200/18 px-2 py-1 text-xs text-stone-500 hover:border-red-500/30 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {isExpanded && row.kind === 'provider' && (
              <ProviderConfigForm
                entry={row}
                initialApiKey={apiKeys[id] ?? ''}
                onSave={(p, key) => {
                  onCatalogChange(updatePlugin(catalog, p.id, () => p));
                  onApiKeyChange(p.id, key);
                  setExpandedId(null);
                }}
                onCancel={() => setExpandedId(null)}
              />
            )}
            {isExpanded && row.kind === 'cli' && (
              <CliConfigForm
                entry={row}
                providers={providers}
                onSave={(a) => {
                  onCatalogChange(updatePlugin(catalog, a.id, () => a));
                  setExpandedId(null);
                }}
                onCancel={() => setExpandedId(null)}
              />
            )}
            {isExpanded && row.kind === 'editor' && (
              <EditorConfigForm
                entry={row}
                onSave={(editor) => {
                  onCatalogChange(updatePlugin(catalog, editor.id, () => editor));
                  setExpandedId(null);
                }}
                onCancel={() => setExpandedId(null)}
              />
            )}
            {isExpanded && row.kind === 'mcp' && (
              <McpConfigForm
                entry={row}
                onSave={(m) => {
                  onCatalogChange(updatePlugin(catalog, m.id, () => m));
                  setExpandedId(null);
                }}
                onCancel={() => setExpandedId(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Marketplace tab ───────────────────────────────────────────────────────────

function MarketplaceTab({
  catalog,
  onInstall,
  onUninstall,
}: {
  catalog: PluginCatalog;
  onInstall: (mp: MarketplacePlugin) => void;
  onUninstall: (id: string) => void;
}) {
  const [activeCat, setActiveCat] = useState<'all' | Category>('all');
  const [query, setQuery] = useState('');

  const installedIds = getInstalledIds(catalog);

  const filtered = MARKETPLACE.filter((mp) => {
    const matchCat = activeCat === 'all' || mp.category === activeCat;
    const matchQ = !query || mp.name.toLowerCase().includes(query.toLowerCase()) || mp.description.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search plugins…"
        className="w-full border border-stone-200/18 bg-[#071d1a]/72 px-4 py-2 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:ring-2 focus:ring-emerald-300/25"
      />

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`px-3 py-1 text-xs transition-colors ${
              activeCat === c.id
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-400/30'
                : 'border border-stone-200/18 text-stone-400 hover:border-stone-200/35 hover:text-stone-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Plugin grid */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-500">No plugins match your search.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((mp) => {
            const installed = installedIds.has(mp.id);
            const badge = kindLabel(mp.kind);
            return (
              <div
                key={mp.id}
                className={`flex items-start gap-3 border p-4 transition-colors ${
                  installed
                    ? 'border-emerald-400/20 bg-emerald-950/30'
                    : 'border-stone-200/18 bg-[#071d1a]/72 hover:border-stone-200/30'
                }`}
              >
                <PluginLogo initials={mp.initials} accentColor={mp.accentColor} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-100">{mp.name}</span>
                    <span className={`border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${badge.cls}`}>{badge.text}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-stone-400">{mp.description}</p>
                </div>
                <button
                  onClick={() => (installed ? onUninstall(mp.id) : onInstall(mp))}
                  className={`ml-1 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                    installed
                      ? 'h-7 w-7 border border-emerald-400/30 text-emerald-400 hover:border-red-400/40 hover:text-red-400'
                      : 'h-7 w-7 border border-stone-200/25 text-stone-400 hover:border-emerald-400/40 hover:text-emerald-300'
                  }`}
                  title={installed ? 'Uninstall' : 'Install'}
                >
                  {installed ? <Check size={14} /> : <Plus size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Skills tab ────────────────────────────────────────────────────────────────

function SkillsTab({ skillsDir }: { skillsDir: string }) {
  const [skills, setSkills] = useState<SkillFileInfo[]>([]);
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rescan = useCallback(async () => {
    if (!skillsDir) {
      setSkills([]);
      return;
    }
    try {
      const list = await skillList(skillsDir);
      setSkills(list);
      setError(null);
    } catch {
      setSkills([]);
    }
  }, [skillsDir]);

  useEffect(() => {
    void rescan();
  }, [rescan]);

  const handleInstall = async () => {
    const url = installUrl.trim();
    if (!url || !skillsDir) return;
    setInstalling(true);
    setError(null);
    try {
      await skillInstallFromUrl(url, skillsDir);
      setInstallUrl('');
      await rescan();
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async (path: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete this skill?\n\n${path}`)) return;
    try {
      await skillUninstall(path, skillsDir);
      await rescan();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleBrowse = async () => {
    try {
      await openPath('https://skillsmp.com');
    } catch {
      setError('Cannot open browser (Tauri runtime required)');
    }
  };

  const handleOpenFolder = async () => {
    if (!skillsDir) return;
    try {
      await openPath(skillsDir);
    } catch {
      setError('Cannot open folder (Tauri runtime required)');
    }
  };

  const btnCls =
    'flex items-center gap-1.5 border border-stone-200/25 px-3 py-1.5 text-xs text-stone-300 hover:bg-white/5 disabled:opacity-50';
  const primaryCls =
    'bg-stone-100 px-3 py-1.5 text-xs font-medium text-[#071d1a] hover:bg-amber-100 disabled:opacity-50';

  return (
    <div className="space-y-4">
      {/* Directory + actions */}
      <div className="space-y-3 border border-stone-200/12 bg-[#061512]/60 p-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Skills directory</p>
          <p className="mt-0.5 break-all font-mono text-xs text-stone-300">
            {skillsDir || '(loading…)'}
          </p>
          <p className="mt-1 text-[11px] text-stone-500">
            Change in{' '}
            <Link href="/settings" className="text-emerald-300/80 hover:text-emerald-200">
              Settings
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleBrowse} className={btnCls}>
            <ExternalLink size={12} /> Browse on skillsmp.com
          </button>
          <button onClick={handleOpenFolder} disabled={!skillsDir} className={btnCls}>
            <FolderOpen size={12} /> Open folder
          </button>
          <button onClick={rescan} disabled={!skillsDir} className={btnCls}>
            <RotateCw size={12} /> Rescan
          </button>
        </div>
      </div>

      {/* Install from URL */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-stone-200">Install from URL</label>
        <div className="flex gap-2">
          <input
            value={installUrl}
            onChange={(e) => setInstallUrl(e.target.value)}
            placeholder="https://example.com/my-skill.md"
            className={inputCls}
          />
          <button
            onClick={handleInstall}
            disabled={installing || !installUrl.trim() || !skillsDir}
            className={primaryCls}
          >
            {installing ? 'Installing…' : 'Install'}
          </button>
        </div>
        <p className="text-[11px] text-stone-500">
          PM downloads the URL contents and saves it as a <span className="font-mono">.md</span> file.
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Skills list */}
      {skills.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-500">No skills found in this directory.</p>
      ) : (
        <div className="divide-y divide-stone-200/10 border border-stone-200/18 bg-[#071d1a]/72">
          {skills.map((s) => (
            <div key={s.absPath} className="flex items-center gap-3 px-4 py-3">
              <FallbackLogo kind="skill" size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-stone-100">{s.relPath}</span>
                  <span className="text-[10px] text-stone-500">{(s.size / 1024).toFixed(1)} KB</span>
                  {s.modified && (
                    <span className="text-[10px] text-stone-500">· {s.modified.slice(0, 10)}</span>
                  )}
                </div>
                <p className="truncate font-mono text-[11px] text-stone-500">{s.absPath}</p>
              </div>
              <button
                onClick={() => void openPath(s.absPath)}
                title="Open file"
                className="border border-stone-200/18 px-2 py-1 text-stone-400 hover:border-stone-200/35 hover:text-stone-100"
              >
                <FileText size={12} />
              </button>
              <button
                onClick={() => handleUninstall(s.absPath)}
                title="Uninstall"
                className="border border-stone-200/18 px-2 py-1 text-stone-500 hover:border-red-500/30 hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────────

const EMPTY_CATALOG: PluginCatalog = { schemaVersion: 2, plugins: [] };

function buildFromMarketplace(mp: MarketplacePlugin): AnyPlugin | null {
  const base = { id: mp.id, name: mp.name, enabled: true, installedAt: new Date().toISOString() };
  if (mp.kind === 'provider' && mp.defaultProvider) {
    return { ...base, kind: 'provider', ...mp.defaultProvider };
  }
  if (mp.kind === 'cli' && mp.defaultCli) {
    return { ...base, kind: 'cli', ...mp.defaultCli };
  }
  if (mp.kind === 'editor' && mp.defaultEditor) {
    return { ...base, kind: 'editor', ...mp.defaultEditor };
  }
  if (mp.kind === 'mcp' && mp.defaultMcp) {
    return { ...base, kind: 'mcp', ...mp.defaultMcp };
  }
  return null;
}

export function PluginsView() {
  const [catalog, setCatalog] = useState<PluginCatalog>(EMPTY_CATALOG);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace' | 'skills'>('installed');
  const [mcpStatuses, setMcpStatuses] = useState<Map<string, McpRunStatus>>(new Map());
  const [logsForId, setLogsForId] = useState<string | null>(null);
  const [skillsDir, setSkillsDirState] = useState('');

  useEffect(() => {
    let cancelled = false;
    const c = loadPluginCatalog();
    setCatalog(c);
    void (async () => {
      const keys = await loadAllApiKeys(selectProviders(c));
      if (!cancelled) setApiKeys(keys);
    })();
    void (async () => {
      const dir = await getSkillsDir();
      if (!cancelled) setSkillsDirState(dir);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to MCP runtime status (no-op in browser dev mode)
  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;

    mcpStatusAll()
      .then((arr) => {
        if (cancelled) return;
        setMcpStatuses(new Map(arr.map((s) => [s.pluginId, s.status])));
      })
      .catch(() => {
        /* not in Tauri */
      });

    onMcpStatus(({ pluginId, status }) => {
      setMcpStatuses((prev) => new Map(prev).set(pluginId, status));
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        /* not in Tauri */
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const updateCatalog = (next: PluginCatalog) => {
    setCatalog(next);
    savePluginCatalog(next);
  };

  const handleApiKeyChange = async (id: string, key: string) => {
    await setProviderApiKey(id, key);
    setApiKeys((prev) => ({ ...prev, [id]: key }));
  };

  const handleInstall = (mp: MarketplacePlugin) => {
    const plugin = buildFromMarketplace(mp);
    if (!plugin) return;
    updateCatalog(addPlugin(catalog, plugin));
    setActiveTab('installed');
  };

  const handleUninstall = (id: string) => {
    updateCatalog(removePlugin(catalog, id));
  };

  const mcpStart = async (plugin: McpPlugin) => {
    if (plugin.transport !== 'stdio') return;
    if (!plugin.command) return;
    try {
      const result = await mcpSpawn({
        pluginId: plugin.id,
        command: plugin.command,
        args: plugin.args ?? [],
        env: plugin.env,
      });
      setMcpStatuses((prev) => new Map(prev).set(plugin.id, result.status));
    } catch (e) {
      setMcpStatuses((prev) => new Map(prev).set(plugin.id, { phase: 'errored', message: String(e) }));
    }
  };

  const mcpStop = async (id: string) => {
    await mcpKill(id);
  };

  const mcpRestart = async (plugin: McpPlugin) => {
    await mcpKill(plugin.id);
    await new Promise((r) => setTimeout(r, 80));
    await mcpStart(plugin);
  };

  const mcpControls: McpControls = {
    statuses: mcpStatuses,
    start: (p) => void mcpStart(p),
    stop: (id) => void mcpStop(id),
    restart: (p) => void mcpRestart(p),
    viewLogs: (id) => setLogsForId(id),
  };

  const installedCount = catalog.plugins.length;

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Plugins</h1>
        <p className="mt-1 text-xs text-stone-400">
          Connect AI providers, agent CLIs, IDEs, MCP servers, and external integrations.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-stone-200/18">
        <button
          onClick={() => setActiveTab('installed')}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === 'installed'
              ? 'border-b-2 border-emerald-400 text-stone-100'
              : 'text-stone-500 hover:text-stone-300'
          }`}
        >
          Installed
          <span className="ml-2 font-mono text-xs text-stone-500">{installedCount}</span>
        </button>
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === 'marketplace'
              ? 'border-b-2 border-emerald-400 text-stone-100'
              : 'text-stone-500 hover:text-stone-300'
          }`}
        >
          Marketplace
          <span className="ml-2 font-mono text-xs text-stone-500">{MARKETPLACE.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === 'skills'
              ? 'border-b-2 border-emerald-400 text-stone-100'
              : 'text-stone-500 hover:text-stone-300'
          }`}
        >
          Skills
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'installed' && (
        <InstalledTab
          catalog={catalog}
          apiKeys={apiKeys}
          mcpControls={mcpControls}
          onCatalogChange={updateCatalog}
          onApiKeyChange={handleApiKeyChange}
        />
      )}
      {activeTab === 'marketplace' && (
        <MarketplaceTab
          catalog={catalog}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
        />
      )}
      {activeTab === 'skills' && <SkillsTab skillsDir={skillsDir} />}

      {logsForId && <McpLogsViewer pluginId={logsForId} onClose={() => setLogsForId(null)} />}
    </div>
  );
}
