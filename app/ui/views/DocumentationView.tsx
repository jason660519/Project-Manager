'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';

const HERMES_BASE = 'http://localhost:9119';

// ── Minimal OpenAPI types ─────────────────────────────────────────────────────

interface OpenAPIInfo {
  title: string;
  version: string;
}

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: { type?: string };
}

interface Operation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: unknown }>;
  };
  responses?: Record<string, { description?: string }>;
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
}

interface OpenAPISpec {
  info: OpenAPIInfo;
  paths: Record<string, PathItem>;
}

type Method = 'get' | 'post' | 'put' | 'delete' | 'patch';

interface Endpoint {
  path: string;
  method: Method;
  operation: Operation;
}

interface Group {
  key: string;
  label: string;
  endpoints: Endpoint[];
  match: (p: string) => boolean;
}

// ── Grouping config ───────────────────────────────────────────────────────────

const GROUPS_CONFIG: { key: string; label: string; match: (p: string) => boolean }[] = [
  {
    key: 'status',
    label: 'Status / Gateway',
    match: (p) =>
      p.startsWith('/api/status') ||
      p.startsWith('/api/gateway') ||
      p.startsWith('/api/hermes') ||
      p.startsWith('/api/actions') ||
      p.startsWith('/api/model'),
  },
  { key: 'sessions', label: 'Sessions', match: (p) => p.startsWith('/api/sessions') },
  { key: 'config', label: 'Config', match: (p) => p.startsWith('/api/config') },
  { key: 'env', label: 'Env Vars', match: (p) => p.startsWith('/api/env') },
  { key: 'oauth', label: 'OAuth Providers', match: (p) => p.startsWith('/api/providers') },
  { key: 'logs', label: 'Logs', match: (p) => p.startsWith('/api/logs') },
  { key: 'cron', label: 'Cron Jobs', match: (p) => p.startsWith('/api/cron') },
  { key: 'skills', label: 'Skills', match: (p) => p.startsWith('/api/skills') },
  { key: 'tools', label: 'Tools', match: (p) => p.startsWith('/api/tools') },
  { key: 'analytics', label: 'Analytics', match: (p) => p.startsWith('/api/analytics') },
  {
    key: 'dashboard',
    label: 'Dashboard',
    match: (p) => p.startsWith('/api/dashboard') || p.startsWith('/dashboard-plugins'),
  },
];

const METHOD_STYLES: Record<Method, string> = {
  get: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40',
  post: 'text-amber-400 bg-amber-950/60 border-amber-800/40',
  put: 'text-blue-400 bg-blue-950/60 border-blue-800/40',
  delete: 'text-red-400 bg-red-950/60 border-red-800/40',
  patch: 'text-purple-400 bg-purple-950/60 border-purple-800/40',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildGroups(paths: Record<string, PathItem>): Group[] {
  const methods: Method[] = ['get', 'post', 'put', 'delete', 'patch'];
  const groups: Group[] = GROUPS_CONFIG.map((g) => ({ ...g, endpoints: [] }));

  for (const [path, pathItem] of Object.entries(paths)) {
    // skip SPA catch-all
    if (path === '/{full_path}') continue;
    for (const method of methods) {
      const op = pathItem[method];
      if (!op) continue;
      const endpoint: Endpoint = { path, method, operation: op };
      const group = groups.find((g) => g.match(path));
      if (group) group.endpoints.push(endpoint);
    }
  }

  return groups.filter((g) => g.endpoints.length > 0);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: Method }) {
  return (
    <span
      className={[
        'inline-flex w-[52px] items-center justify-center border px-1 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
        METHOD_STYLES[method],
      ].join(' ')}
    >
      {method}
    </span>
  );
}

function EndpointRow({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);
  const { path, method, operation } = endpoint;
  const params = operation.parameters ?? [];
  const pathParams = params.filter((p) => p.in === 'path');
  const queryParams = params.filter((p) => p.in === 'query');
  const hasBody = !!operation.requestBody;
  const responses = Object.entries(operation.responses ?? {});

  return (
    <div className="border-b border-stone-200/8 last:border-0">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/3"
        onClick={() => setExpanded((v) => !v)}
      >
        <MethodBadge method={method} />
        <span className="flex-1 font-mono text-[12px] text-stone-200">{path}</span>
        {operation.summary && (
          <span className="hidden text-[11px] text-stone-400 sm:block">{operation.summary}</span>
        )}
        {expanded ? (
          <ChevronDown size={13} className="shrink-0 text-stone-500" />
        ) : (
          <ChevronRight size={13} className="shrink-0 text-stone-500" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-stone-200/8 bg-black/20 px-4 py-3 text-[11px]">
          {operation.description && (
            <p className="mb-3 leading-5 text-stone-300">{operation.description}</p>
          )}

          {pathParams.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 font-semibold uppercase tracking-[0.12em] text-stone-500">
                Path Params
              </p>
              <div className="space-y-1">
                {pathParams.map((p) => (
                  <div key={p.name} className="flex items-start gap-2">
                    <span className="font-mono text-amber-300">{p.name}</span>
                    {p.required && (
                      <span className="rounded border border-red-800/50 bg-red-950/40 px-1 text-[9px] text-red-400">
                        required
                      </span>
                    )}
                    {p.schema?.type && (
                      <span className="text-stone-500">{p.schema.type}</span>
                    )}
                    {p.description && <span className="text-stone-400">{p.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {queryParams.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 font-semibold uppercase tracking-[0.12em] text-stone-500">
                Query Params
              </p>
              <div className="space-y-1">
                {queryParams.map((p) => (
                  <div key={p.name} className="flex items-start gap-2">
                    <span className="font-mono text-blue-300">{p.name}</span>
                    {p.required && (
                      <span className="rounded border border-red-800/50 bg-red-950/40 px-1 text-[9px] text-red-400">
                        required
                      </span>
                    )}
                    {p.schema?.type && (
                      <span className="text-stone-500">{p.schema.type}</span>
                    )}
                    {p.description && <span className="text-stone-400">{p.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasBody && (
            <div className="mb-3">
              <p className="mb-1 font-semibold uppercase tracking-[0.12em] text-stone-500">
                Request Body
              </p>
              <p className="text-stone-400">
                {operation.requestBody?.required ? (
                  <span className="text-amber-400">Required · </span>
                ) : null}
                {Object.keys(operation.requestBody?.content ?? {}).join(', ')}
              </p>
            </div>
          )}

          {responses.length > 0 && (
            <div>
              <p className="mb-1.5 font-semibold uppercase tracking-[0.12em] text-stone-500">
                Responses
              </p>
              <div className="space-y-1">
                {responses.map(([code, res]) => (
                  <div key={code} className="flex items-center gap-2">
                    <span
                      className={[
                        'font-mono font-semibold',
                        code.startsWith('2') ? 'text-emerald-400' : 'text-red-400',
                      ].join(' ')}
                    >
                      {code}
                    </span>
                    {res.description && (
                      <span className="text-stone-400">{res.description}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function DocumentationView() {
  const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'live' | 'offline'>('loading');
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadSpec = useCallback(async () => {
    setStatus('loading');
    setFetchError(null);
    try {
      const res = await fetch(`${HERMES_BASE}/openapi.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: OpenAPISpec = await res.json();
      setSpec(data);
      const g = buildGroups(data.paths);
      setGroups(g);
      if (g.length > 0 && !activeGroup) setActiveGroup(g[0].key);
      setStatus('live');
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('offline');
    }
  }, [activeGroup]);

  useEffect(() => {
    void loadSpec();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentGroup = groups.find((g) => g.key === activeGroup);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <BookOpen size={15} className="text-stone-400" />
          <div>
            <h1 className="text-[13px] font-semibold text-stone-100">
              {spec ? spec.info.title : 'Documentation'}
            </h1>
            {spec && (
              <p className="text-[11px] text-stone-500">v{spec.info.version} · OAS 3.1</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status dot */}
          <div className="flex items-center gap-1.5">
            <span
              className={[
                'inline-block h-1.5 w-1.5 rounded-full',
                status === 'live'
                  ? 'bg-emerald-400'
                  : status === 'offline'
                    ? 'bg-red-400'
                    : 'animate-pulse bg-stone-500',
              ].join(' ')}
            />
            <span className="text-[11px] text-stone-500">
              {status === 'live' ? 'LIVE' : status === 'offline' ? 'OFFLINE' : '...'}
            </span>
          </div>

          <button
            onClick={() => void loadSpec()}
            className="flex items-center gap-1.5 border border-stone-200/15 px-2 py-1 text-[11px] text-stone-400 transition-colors hover:border-stone-200/30 hover:text-stone-200"
          >
            <RefreshCw size={11} />
            Refresh
          </button>

          <a
            href={`${HERMES_BASE}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 border border-stone-200/15 px-2 py-1 text-[11px] text-stone-400 transition-colors hover:border-stone-200/30 hover:text-stone-200"
          >
            <ExternalLink size={11} />
            Full Swagger
          </a>
        </div>
      </div>

      {/* Body */}
      {status === 'offline' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="h-8 w-8 rounded-full border border-red-800/40 bg-red-950/30 flex items-center justify-center">
            <span className="text-[16px]">!</span>
          </div>
          <p className="text-[13px] text-stone-300">Cannot reach Hermes Agent</p>
          <p className="text-[11px] text-stone-500">
            {fetchError ?? 'Make sure the agent is running at localhost:9119'}
          </p>
          <button
            onClick={() => void loadSpec()}
            className="mt-2 border border-stone-200/15 px-3 py-1.5 text-[11px] text-stone-300 transition-colors hover:border-stone-200/30"
          >
            Retry
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="flex flex-1 items-center justify-center text-[12px] text-stone-500">
          Loading spec from localhost:9119…
        </div>
      )}

      {status === 'live' && groups.length > 0 && (
        <div className="flex flex-1 overflow-hidden">
          {/* Group sidebar */}
          <aside className="w-44 shrink-0 overflow-y-auto border-r border-stone-200/10 py-3">
            {groups.map((g) => (
              <button
                key={g.key}
                onClick={() => setActiveGroup(g.key)}
                className={[
                  'flex w-full items-center justify-between px-4 py-2 text-left text-[11px] transition-colors',
                  g.key === activeGroup
                    ? 'bg-emerald-950/40 text-stone-100'
                    : 'text-stone-400 hover:bg-white/3 hover:text-stone-200',
                ].join(' ')}
              >
                <span>{g.label}</span>
                <span className="text-[10px] text-stone-600">{g.endpoints.length}</span>
              </button>
            ))}
          </aside>

          {/* Endpoint list */}
          <main className="flex-1 overflow-y-auto">
            {currentGroup && (
              <>
                <div className="border-b border-stone-200/8 px-4 py-3">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                    {currentGroup.label}
                  </h2>
                  <p className="text-[11px] text-stone-600">
                    {currentGroup.endpoints.length} endpoint
                    {currentGroup.endpoints.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div>
                  {currentGroup.endpoints.map((ep) => (
                    <EndpointRow key={`${ep.method}:${ep.path}`} endpoint={ep} />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
