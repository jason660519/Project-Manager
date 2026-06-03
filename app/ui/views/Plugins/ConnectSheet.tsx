'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';

export interface CustomConnector {
  id: string;
  name: string;
  serverUrl: string;
  connected: boolean;
  addedAt: string;
}

interface ConnectorDef {
  id: string;
  category: string;
  name: string;
  icon: string;
  method: string;
  instructions: string;
  isCustom?: true;
  serverUrl?: string;
}

const BUILTIN_CONNECTORS: ConnectorDef[] = [
  {
    id: 'google-calendar',
    category: 'Productivity',
    name: 'Google Calendar',
    icon: '📅',
    method: 'OAuth 2.0',
    instructions: 'Enable Calendar API in Google Cloud → OAuth consent screen → scope calendar.readonly',
  },
  {
    id: 'google-drive',
    category: 'Productivity',
    name: 'Google Drive',
    icon: '📁',
    method: 'OAuth 2.0',
    instructions: 'Enable Drive API in Google Cloud → OAuth 2.0 credentials → set redirect URI',
  },
  {
    id: 'github',
    category: 'Dev',
    name: 'GitHub',
    icon: '🐙',
    method: 'API Token',
    instructions: 'GitHub Settings → Developer settings → Personal access tokens → Generate new token',
  },
  {
    id: 'vercel',
    category: 'Dev',
    name: 'Vercel',
    icon: '▲',
    method: 'API Token',
    instructions: 'Vercel Dashboard → Account Settings → Tokens → Create token with desired scope',
  },
  {
    id: 'notion',
    category: 'Productivity',
    name: 'Notion',
    icon: '📝',
    method: 'OAuth 2.0',
    instructions: 'Notion Settings → Connections → Develop integrations → Create new integration',
  },
  {
    id: 'gamma',
    category: 'Productivity',
    name: 'Gamma',
    icon: '⚡',
    method: 'OAuth 2.0',
    instructions: 'Gamma Account Settings → API access → Authorize OAuth application',
  },
  {
    id: 'linear',
    category: 'Project',
    name: 'Linear',
    icon: '🔷',
    method: 'API Key',
    instructions: 'Linear Settings → API → Personal API keys → Create key with workspace access',
  },
  {
    id: 'outlook',
    category: 'Ops',
    name: 'Outlook',
    icon: '✉️',
    method: 'OAuth 2.0 (Azure AD)',
    instructions: 'Azure Portal → App registrations → API permissions → Mail.ReadWrite',
  },
  {
    id: 'outlook-calendar',
    category: 'Ops',
    name: 'Outlook Calendar',
    icon: '🗓️',
    method: 'OAuth 2.0 (Azure AD)',
    instructions: 'Azure Portal → App registrations → API permissions → Calendars.ReadWrite',
  },
  {
    id: 'canva',
    category: 'Design',
    name: 'Canva',
    icon: '🎨',
    method: 'OAuth 2.0',
    instructions: 'Canva for Developers → Create app → Enable OAuth → set redirect URI',
  },
];

const CATEGORY_ORDER = ['Dev', 'Ops', 'Productivity', 'Project', 'Design', 'Custom'];

const STORAGE_KEY = 'pm:connect:state';

interface ConnectState {
  connected: Record<string, boolean>;
  custom: CustomConnector[];
}

function loadState(): ConnectState {
  if (typeof window === 'undefined') return { connected: {}, custom: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConnectState) : { connected: {}, custom: [] };
  } catch {
    return { connected: {}, custom: [] };
  }
}

function saveState(state: ConnectState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

interface CustomConnectorDialogProps {
  onAdd: (name: string, serverUrl: string) => void;
  onClose: () => void;
}

function CustomConnectorDialog({ onAdd, onClose }: CustomConnectorDialogProps) {
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !serverUrl.trim()) return;
    onAdd(name.trim(), serverUrl.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md border border-stone-200/15 bg-[rgb(var(--pm-panel))] shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200/10 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-100">Custom Connector</h3>
            <p className="mt-0.5 text-xs text-stone-400">Enter a custom name and an MCP server URL</p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-stone-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-300">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Connector"
              autoFocus
              className="border border-stone-200/18 bg-stone-900/60 px-3 py-2 text-sm text-stone-100 placeholder-stone-500 outline-none focus:ring-2 focus:ring-emerald-300/25"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-300">Server URL</label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://mcp.example.com/sse"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="border border-stone-200/18 bg-stone-900/60 px-3 py-2 text-sm text-stone-100 placeholder-stone-500 outline-none focus:ring-2 focus:ring-emerald-300/25"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-stone-200/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-stone-300 hover:text-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!name.trim() || !serverUrl.trim()}
            className="bg-stone-600 px-4 py-1.5 text-sm font-medium text-stone-100 hover:bg-stone-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add Connector
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConnectorRowProps {
  row: ConnectorDef;
  isConnected: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}

function ConnectorRow({ row, isConnected, onToggle, onRemove }: ConnectorRowProps) {
  return (
    <tr className={`border-b border-stone-200/8 transition-colors ${isConnected ? 'bg-emerald-950/10' : 'hover:bg-white/3'}`}>
      {/* Category */}
      <td className="whitespace-nowrap px-3 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">
          {row.category}
        </span>
      </td>

      {/* Name */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">{row.icon}</span>
          <span className="text-xs font-semibold text-stone-100">{row.name}</span>
          {row.isCustom && (
            <span className="rounded bg-stone-700/50 px-1 py-0.5 text-[9px] uppercase tracking-wider text-stone-400">
              custom
            </span>
          )}
        </div>
        {row.serverUrl && (
          <p className="mt-0.5 truncate pl-6 text-[10px] text-stone-600" title={row.serverUrl}>
            {row.serverUrl}
          </p>
        )}
      </td>

      {/* Method */}
      <td className="whitespace-nowrap px-3 py-2.5">
        <span className="border border-stone-200/15 bg-stone-800/50 px-2 py-0.5 text-[10px] text-stone-300">
          {row.method}
        </span>
      </td>

      {/* Instructions */}
      <td className="max-w-[280px] px-3 py-2.5">
        <p className="text-[11px] leading-relaxed text-stone-400">{row.instructions}</p>
      </td>

      {/* Status + Action */}
      <td className="whitespace-nowrap px-3 py-2.5">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Connected
              </span>
              <button
                type="button"
                onClick={onToggle}
                className="border border-stone-400/20 px-2 py-0.5 text-[10px] text-stone-400 hover:border-red-400/40 hover:text-red-400"
              >
                Revoke
              </button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1 text-[11px] text-stone-500">
                <span className="h-1.5 w-1.5 rounded-full bg-stone-600" />
                Not connected
              </span>
              <button
                type="button"
                onClick={onToggle}
                className="border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-400 hover:border-emerald-400/50 hover:bg-emerald-950/25"
              >
                Connect
              </button>
            </>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="ml-1 text-stone-600 hover:text-red-400"
              title="Remove"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ConnectSheet() {
  const [state, setState] = useState<ConnectState>({ connected: {}, custom: [] });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setState(loadState());
    setMounted(true);
  }, []);

  const persist = (updater: (prev: ConnectState) => ConnectState) => {
    setState((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  };

  const toggleBuiltin = (id: string) =>
    persist((prev) => ({
      ...prev,
      connected: { ...prev.connected, [id]: !prev.connected[id] },
    }));

  const toggleCustom = (id: string) =>
    persist((prev) => ({
      ...prev,
      custom: prev.custom.map((c) => (c.id === id ? { ...c, connected: !c.connected } : c)),
    }));

  const removeCustom = (id: string) =>
    persist((prev) => ({ ...prev, custom: prev.custom.filter((c) => c.id !== id) }));

  const addCustom = (name: string, serverUrl: string) => {
    const connector: CustomConnector = {
      id: crypto.randomUUID(),
      name,
      serverUrl,
      connected: false,
      addedAt: new Date().toISOString(),
    };
    persist((prev) => ({ ...prev, custom: [...prev.custom, connector] }));
    setDialogOpen(false);
  };

  if (!mounted) return null;

  const connectedCount =
    Object.values(state.connected).filter(Boolean).length +
    state.custom.filter((c) => c.connected).length;

  const totalCount = BUILTIN_CONNECTORS.length + state.custom.length;

  // Merge custom connectors into row format
  const customRows: ConnectorDef[] = state.custom.map((c) => ({
    id: c.id,
    category: 'Custom',
    name: c.name,
    icon: '🔌',
    method: 'MCP Server',
    instructions: c.serverUrl,
    isCustom: true,
    serverUrl: c.serverUrl,
  }));

  const allRows = [...BUILTIN_CONNECTORS, ...customRows];

  // Sort by category order
  const sorted = [...allRows].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-xs text-stone-400">
          {connectedCount} / {totalCount} connected
        </span>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 border border-emerald-500/25 bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-400 hover:border-emerald-400/40 hover:bg-emerald-950/35"
        >
          <Plus size={12} />
          Add your own connector
        </button>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-40 bg-[rgb(var(--pm-panel))]">
            <tr className="border-b border-stone-200/15">
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500 whitespace-nowrap">
                Category
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                Tool
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500 whitespace-nowrap">
                Install Method
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                Instructions
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500 whitespace-nowrap">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isConnected = row.isCustom
                ? !!(state.custom.find((c) => c.id === row.id)?.connected)
                : !!state.connected[row.id];
              return (
                <ConnectorRow
                  key={row.id}
                  row={row}
                  isConnected={isConnected}
                  onToggle={() => (row.isCustom ? toggleCustom(row.id) : toggleBuiltin(row.id))}
                  onRemove={row.isCustom ? () => removeCustom(row.id) : undefined}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {dialogOpen && <CustomConnectorDialog onAdd={addCustom} onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
