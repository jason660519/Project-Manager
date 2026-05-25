'use client';

import { CheckCircle2, ChevronDown, ChevronRight, Code2, FileSearch, FolderSearch, Loader2, Search, Settings2, Terminal, Wrench, XCircle } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ToolCallDisplay {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  error?: boolean;
  status: 'running' | 'done' | 'error';
}

const TOOL_ICONS: Record<string, React.ComponentType<{ size: number; className?: string }>> = {
  read_file: FileSearch,
  search_code: Search,
  list_features: FolderSearch,
  get_feature: FileSearch,
  get_runs: Terminal,
  get_config: Settings2,
  run_command: Terminal,
  read_memory: FileSearch,
  write_memory: FileSearch,
  web_search: Search,
};

const TOOL_LABELS: Record<string, string> = {
  read_file: '讀取檔案',
  search_code: '搜尋程式碼',
  list_features: '列出功能',
  get_feature: '查看功能',
  get_runs: '查看執行紀錄',
  get_config: '查看設定',
  run_command: '執行指令',
  read_memory: '讀取記憶',
  write_memory: '儲存記憶',
  web_search: '搜尋網路',
};

function formatArgs(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'read_file': return `📄 ${args.path || '?'}`;
    case 'search_code': return `🔍 "${args.query || '?'}"`;
    case 'list_features': return `📋 ${args.phase ? `phase: ${args.phase}` : '全部功能'}${args.status ? `, status: ${args.status}` : ''}`;
    case 'get_feature': return `📌 ${args.feature_id || '?'}`;
    case 'get_runs': return `🏃 ${args.limit ? `最近 ${args.limit} 筆` : '執行紀錄'}`;
    case 'get_config': return '⚙️ 專案設定';
    case 'run_command': return `💻 \`${(args.command as string)?.slice(0, 60) || '?'}\``;
    case 'read_memory': return `🧠 ${args.key || '全部記憶'}`;
    case 'write_memory': return `💾 ${args.key}: ${(args.value as string)?.slice(0, 40) || ''}`;
    case 'web_search': return `🌐 "${args.query || '?'}"`;
    default: return JSON.stringify(args).slice(0, 80);
  }
}

// ── Component ───────────────────────────────────────────────────────────────

interface ToolCallCardProps {
  call: ToolCallDisplay;
}

export function ToolCallCard({ call }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = call.status === 'running';
  const isError = call.status === 'error';
  const isDone = call.status === 'done';
  const Icon = TOOL_ICONS[call.name] || Wrench;
  const label = TOOL_LABELS[call.name] || call.name;

  return (
    <div
      className={[
        'group rounded border px-2.5 py-2 text-[11px] leading-relaxed transition-all',
        isRunning ? 'border-amber-200/20 bg-amber-950/20 animate-pulse' :
        isError ? 'border-red-400/20 bg-red-950/20' :
        'border-stone-200/15 bg-stone-950/60',
      ].join(' ')}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => call.result && setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        {isRunning ? (
          <Loader2 size={13} className="shrink-0 animate-spin text-amber-300/80" />
        ) : isError ? (
          <XCircle size={13} className="shrink-0 text-red-400" />
        ) : (
          <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
        )}
        
        <Icon size={13} className="shrink-0 text-stone-400" />
        
        <span className="flex-1 truncate text-[10px] font-medium text-stone-300">
          {label}
        </span>
        
        <span className="text-[9px] text-stone-500 max-w-[200px] truncate">
          {formatArgs(call.name, call.arguments)}
        </span>
        
        {call.result && (
          <span className="shrink-0 text-stone-500">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
      </button>

      {/* Expanded result */}
      {expanded && call.result && (
        <div className={[
          'mt-2 overflow-x-auto rounded border px-2 py-1.5 font-mono text-[10px]',
          isError ? 'border-red-400/15 bg-red-950/30 text-red-200/80' :
          'border-stone-200/10 bg-black/30 text-stone-200/80',
        ].join(' ')}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              pre: ({ children }) => <pre className="my-1 whitespace-pre-wrap">{children}</pre>,
              code: ({ children }) => <code className="text-cyan-200">{children}</code>,
            }}
          >
            {call.result}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// ── Group container ─────────────────────────────────────────────────────────

interface ToolCallGroupProps {
  calls: ToolCallDisplay[];
}

export function ToolCallGroup({ calls }: ToolCallGroupProps) {
  if (calls.length === 0) return null;
  
  return (
    <div className="mr-4 space-y-1.5 mb-2">
      {calls.map((call) => (
        <ToolCallCard key={call.id} call={call} />
      ))}
    </div>
  );
}
