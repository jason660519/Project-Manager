'use client';

import { useEffect, useState } from 'react';
import { Bot, Check, ChevronDown, ChevronUp, Eye, EyeOff, Globe, Monitor, Plus, Trash2 } from 'lucide-react';

import type { AgentPluginEntry, IdePluginEntry, PluginCatalog, ProviderEntry } from '../../../lib/types/plugins';
import {
  loadAllApiKeys,
  loadPluginCatalog,
  savePluginCatalog,
  setProviderApiKey,
} from '../../../lib/storage/plugins';

// ─── Static marketplace catalog ────────────────────────────────────────────────

type Category = 'ai' | 'dev' | 'vcs' | 'pm' | 'ci' | 'notify';
type PluginKind = 'provider' | 'agent' | 'ide';

interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  category: Category;
  kind: PluginKind;
  accentColor: string;
  initials: string;
  defaultProvider?: Omit<ProviderEntry, 'id' | 'enabled'>;
  defaultAgent?: Omit<AgentPluginEntry, 'id' | 'enabled'>;
  defaultIde?: Omit<IdePluginEntry, 'id' | 'enabled'>;
}

const MARKETPLACE: MarketplacePlugin[] = [
  // AI Providers
  {
    id: 'anthropic', name: 'Anthropic', description: 'Access Claude models including Opus, Sonnet, and Haiku.',
    category: 'ai', kind: 'provider', accentColor: 'bg-[#c47a3a]', initials: 'AN',
    defaultProvider: { name: 'Anthropic', baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-6', models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
  },
  {
    id: 'openai', name: 'OpenAI', description: 'GPT-4o, o1, o3-mini and other OpenAI models.',
    category: 'ai', kind: 'provider', accentColor: 'bg-[#10a37f]', initials: 'OA',
    defaultProvider: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'] },
  },
  {
    id: 'google', name: 'Google Gemini', description: 'Gemini 2.5 Pro, Flash and Gemini 1.5 models.',
    category: 'ai', kind: 'provider', accentColor: 'bg-[#4285f4]', initials: 'GG',
    defaultProvider: { name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.0-flash', models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'] },
  },
  {
    id: 'ollama', name: 'Ollama', description: 'Run Llama, Mistral, and other models locally on your machine.',
    category: 'ai', kind: 'provider', accentColor: 'bg-stone-600', initials: 'OL',
    defaultProvider: { name: 'Ollama', baseUrl: 'http://localhost:11434', defaultModel: 'llama3', models: ['llama3', 'llama3:70b', 'mistral', 'codellama'] },
  },
  // Agents
  {
    id: 'claude-code', name: 'Claude Code', description: 'Agentic CLI for software engineering tasks.',
    category: 'dev', kind: 'agent', accentColor: 'bg-[#c47a3a]', initials: 'CC',
    defaultAgent: { name: 'Claude Code', command: 'claude', argsTemplate: ['--cwd', '{root}', '{prompt}'], providerId: 'anthropic' },
  },
  {
    id: 'codex', name: 'Codex CLI', description: 'OpenAI Codex command-line agent for code tasks.',
    category: 'dev', kind: 'agent', accentColor: 'bg-[#10a37f]', initials: 'CX',
    defaultAgent: { name: 'Codex CLI', command: 'codex', argsTemplate: ['exec', '--cwd', '{root}', '{prompt}'], providerId: 'openai' },
  },
  {
    id: 'aider', name: 'Aider', description: 'AI pair programmer that edits code in your terminal.',
    category: 'dev', kind: 'agent', accentColor: 'bg-violet-700', initials: 'AD',
    defaultAgent: { name: 'Aider', command: 'aider', argsTemplate: ['--yes', '--message', '{prompt}'] },
  },
  // IDEs
  {
    id: 'cursor', name: 'Cursor', description: 'AI-first code editor built on VS Code.',
    category: 'dev', kind: 'ide', accentColor: 'bg-[#6b6cf6]', initials: 'CR',
    defaultIde: { name: 'Cursor', command: 'cursor' },
  },
  {
    id: 'vscode', name: 'VS Code', description: 'Microsoft Visual Studio Code editor.',
    category: 'dev', kind: 'ide', accentColor: 'bg-[#007acc]', initials: 'VS',
    defaultIde: { name: 'VS Code', command: 'code' },
  },
  {
    id: 'zed', name: 'Zed', description: 'High-performance multiplayer code editor.',
    category: 'dev', kind: 'ide', accentColor: 'bg-[#084ccd]', initials: 'ZD',
    defaultIde: { name: 'Zed', command: 'zed' },
  },
  {
    id: 'trae', name: 'Trae', description: 'ByteDance AI-native code editor.',
    category: 'dev', kind: 'ide', accentColor: 'bg-[#1a6b5c]', initials: 'TR',
    defaultIde: { name: 'Trae', command: 'trae' },
  },
  {
    id: 'antigravity', name: 'Antigravity', description: 'Antigravity AI-native IDE.',
    category: 'dev', kind: 'ide', accentColor: 'bg-[#2b2540]', initials: 'AG',
    defaultIde: { name: 'Antigravity', command: 'antigravity' },
  },
  // Future integrations (placeholder)
  {
    id: 'github', name: 'GitHub', description: 'Sync pull requests and issues to your projects.',
    category: 'vcs', kind: 'agent', accentColor: 'bg-stone-700', initials: 'GH',
    defaultAgent: { name: 'GitHub', command: 'gh', argsTemplate: [] },
  },
  {
    id: 'linear', name: 'Linear', description: 'Pull issues and cycles into DevPilot features.',
    category: 'pm', kind: 'agent', accentColor: 'bg-[#5e6ad2]', initials: 'LN',
    defaultAgent: { name: 'Linear', command: 'linear', argsTemplate: [] },
  },
  {
    id: 'slack', name: 'Slack', description: 'Notify channels when tasks are dispatched.',
    category: 'notify', kind: 'agent', accentColor: 'bg-[#4a154b]', initials: 'SL',
    defaultAgent: { name: 'Slack', command: 'slack', argsTemplate: [] },
  },
  {
    id: 'sentry', name: 'Sentry', description: 'Import recent errors as engineering tasks.',
    category: 'ci', kind: 'agent', accentColor: 'bg-[#fb4226]', initials: 'SE',
    defaultAgent: { name: 'Sentry', command: 'sentry', argsTemplate: [] },
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

function uid(): string {
  return typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function getInstalledIds(catalog: PluginCatalog): Set<string> {
  return new Set([
    ...catalog.providers.map((p) => p.id),
    ...catalog.agents.map((a) => a.id),
    ...catalog.ides.map((i) => i.id),
  ]);
}

function kindLabel(kind: PluginKind) {
  if (kind === 'provider') return { text: 'Provider', cls: 'text-emerald-300 border-emerald-200/25' };
  if (kind === 'agent') return { text: 'Agent', cls: 'text-cyan-300 border-cyan-200/25' };
  return { text: 'IDE', cls: 'text-amber-300 border-amber-200/25' };
}

function kindIcon(kind: PluginKind) {
  if (kind === 'provider') return Globe;
  if (kind === 'agent') return Bot;
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

const inputCls =
  'w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35 placeholder:text-stone-600';

// ─── Configure forms ───────────────────────────────────────────────────────────

function ProviderConfigForm({
  entry,
  initialApiKey,
  onSave,
  onCancel,
}: {
  entry: ProviderEntry;
  initialApiKey: string;
  onSave: (p: ProviderEntry, key: string) => void;
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

function AgentConfigForm({
  entry,
  providers,
  onSave,
  onCancel,
}: {
  entry: AgentPluginEntry;
  providers: ProviderEntry[];
  onSave: (a: AgentPluginEntry) => void;
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

function IdeConfigForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: IdePluginEntry;
  onSave: (ide: IdePluginEntry) => void;
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

// ─── Installed tab ─────────────────────────────────────────────────────────────

type InstalledRow =
  | { kind: 'provider'; entry: ProviderEntry }
  | { kind: 'agent'; entry: AgentPluginEntry }
  | { kind: 'ide'; entry: IdePluginEntry };

function InstalledTab({
  catalog,
  apiKeys,
  onCatalogChange,
  onApiKeyChange,
}: {
  catalog: PluginCatalog;
  apiKeys: Record<string, string>;
  onCatalogChange: (c: PluginCatalog) => void;
  onApiKeyChange: (id: string, key: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows: InstalledRow[] = [
    ...catalog.providers.map((e): InstalledRow => ({ kind: 'provider', entry: e })),
    ...catalog.agents.map((e): InstalledRow => ({ kind: 'agent', entry: e })),
    ...catalog.ides.map((e): InstalledRow => ({ kind: 'ide', entry: e })),
  ];

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  const removeEntry = (row: InstalledRow) => {
    const id = row.entry.id;
    if (expandedId === id) setExpandedId(null);
    if (row.kind === 'provider') onCatalogChange({ ...catalog, providers: catalog.providers.filter((p) => p.id !== id) });
    else if (row.kind === 'agent') onCatalogChange({ ...catalog, agents: catalog.agents.filter((a) => a.id !== id) });
    else onCatalogChange({ ...catalog, ides: catalog.ides.filter((i) => i.id !== id) });
  };

  const toggleEnabled = (row: InstalledRow) => {
    const id = row.entry.id;
    if (row.kind === 'provider') {
      onCatalogChange({ ...catalog, providers: catalog.providers.map((p) => p.id === id ? { ...p, enabled: !(p.enabled ?? true) } : p) });
    } else if (row.kind === 'agent') {
      onCatalogChange({ ...catalog, agents: catalog.agents.map((a) => a.id === id ? { ...a, enabled: !(a.enabled ?? true) } : a) });
    } else {
      onCatalogChange({ ...catalog, ides: catalog.ides.map((i) => i.id === id ? { ...i, enabled: !(i.enabled ?? true) } : i) });
    }
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
        const id = row.entry.id;
        const mp = marketplaceFor(id);
        const isExpanded = expandedId === id;
        const enabled = row.entry.enabled ?? true;
        const badge = kindLabel(row.kind);

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
                  <span className={`text-sm font-medium ${enabled ? 'text-stone-100' : 'text-stone-500'}`}>{row.entry.name}</span>
                  <span className={`border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${badge.cls}`}>{badge.text}</span>
                  {row.kind === 'provider' && apiKeys[id] && (
                    <span className="border border-emerald-200/25 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-emerald-300/80">key set</span>
                  )}
                </div>
                <p className="mt-0.5 truncate font-mono text-[11px] text-stone-500">
                  {row.kind === 'provider'
                    ? (row.entry as ProviderEntry).baseUrl
                    : (row.entry as AgentPluginEntry | IdePluginEntry).command}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* Enable toggle */}
                <button
                  onClick={() => toggleEnabled(row)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? 'bg-emerald-600' : 'bg-stone-700'}`}
                  title={enabled ? 'Disable' : 'Enable'}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>

                {/* Configure */}
                <button
                  onClick={() => toggle(id)}
                  className="flex items-center gap-1 border border-stone-200/18 px-2 py-1 text-xs text-stone-400 hover:border-stone-200/35 hover:text-stone-100"
                >
                  Configure
                  {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>

                {/* Remove */}
                <button
                  onClick={() => removeEntry(row)}
                  className="border border-stone-200/18 px-2 py-1 text-xs text-stone-500 hover:border-red-500/30 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {isExpanded && row.kind === 'provider' && (
              <ProviderConfigForm
                entry={row.entry as ProviderEntry}
                initialApiKey={apiKeys[id] ?? ''}
                onSave={(p, key) => {
                  onCatalogChange({ ...catalog, providers: catalog.providers.map((x) => (x.id === p.id ? p : x)) });
                  onApiKeyChange(p.id, key);
                  setExpandedId(null);
                }}
                onCancel={() => setExpandedId(null)}
              />
            )}
            {isExpanded && row.kind === 'agent' && (
              <AgentConfigForm
                entry={row.entry as AgentPluginEntry}
                providers={catalog.providers}
                onSave={(a) => {
                  onCatalogChange({ ...catalog, agents: catalog.agents.map((x) => (x.id === a.id ? a : x)) });
                  setExpandedId(null);
                }}
                onCancel={() => setExpandedId(null)}
              />
            )}
            {isExpanded && row.kind === 'ide' && (
              <IdeConfigForm
                entry={row.entry as IdePluginEntry}
                onSave={(ide) => {
                  onCatalogChange({ ...catalog, ides: catalog.ides.map((x) => (x.id === ide.id ? ide : x)) });
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
  onUninstall: (id: string, kind: PluginKind) => void;
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
                  onClick={() => (installed ? onUninstall(mp.id, mp.kind) : onInstall(mp))}
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

// ─── Main view ─────────────────────────────────────────────────────────────────

export function PluginsView() {
  const [catalog, setCatalog] = useState<PluginCatalog>({ providers: [], agents: [], ides: [] });
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>('installed');

  useEffect(() => {
    let cancelled = false;
    const c = loadPluginCatalog();
    setCatalog(c);
    void (async () => {
      const keys = await loadAllApiKeys(c.providers);
      if (!cancelled) setApiKeys(keys);
    })();
    return () => {
      cancelled = true;
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
    if (mp.kind === 'provider' && mp.defaultProvider) {
      const entry: ProviderEntry = { id: mp.id, ...mp.defaultProvider };
      updateCatalog({ ...catalog, providers: [...catalog.providers, entry] });
    } else if (mp.kind === 'agent' && mp.defaultAgent) {
      const entry: AgentPluginEntry = { id: mp.id, ...mp.defaultAgent };
      updateCatalog({ ...catalog, agents: [...catalog.agents, entry] });
    } else if (mp.kind === 'ide' && mp.defaultIde) {
      const entry: IdePluginEntry = { id: mp.id, ...mp.defaultIde };
      updateCatalog({ ...catalog, ides: [...catalog.ides, entry] });
    }
    setActiveTab('installed');
  };

  const handleUninstall = (id: string, kind: PluginKind) => {
    if (kind === 'provider') updateCatalog({ ...catalog, providers: catalog.providers.filter((p) => p.id !== id) });
    else if (kind === 'agent') updateCatalog({ ...catalog, agents: catalog.agents.filter((a) => a.id !== id) });
    else updateCatalog({ ...catalog, ides: catalog.ides.filter((i) => i.id !== id) });
  };

  const installedCount = catalog.providers.length + catalog.agents.length + catalog.ides.length;

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Plugins</h1>
        <p className="mt-1 text-xs text-stone-400">
          Connect AI providers, agent CLIs, IDEs, and external integrations.
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
      </div>

      {/* Tab content */}
      {activeTab === 'installed' ? (
        <InstalledTab
          catalog={catalog}
          apiKeys={apiKeys}
          onCatalogChange={updateCatalog}
          onApiKeyChange={handleApiKeyChange}
        />
      ) : (
        <MarketplaceTab
          catalog={catalog}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
        />
      )}
    </div>
  );
}
