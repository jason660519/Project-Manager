'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Clock, Cpu, ScrollText, ChevronRight } from 'lucide-react';
import type { AgentSession } from '../../../lib/types';

interface SessionsViewProps {
  projectRoot?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function groupByDate(sessions: AgentSession[]): Record<string, AgentSession[]> {
  const groups: Record<string, AgentSession[]> = {};
  for (const s of sessions) {
    const key = formatDate(s.startedAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return groups;
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-stone-500">
      <ScrollText size={32} strokeWidth={1.2} />
      <p className="text-sm">選一個 session 查看對話內容</p>
    </div>
  );
}

function NoSessions() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-stone-500">
      <MessageSquare size={32} strokeWidth={1.2} />
      <p className="text-center text-sm leading-6">
        尚無對話紀錄。
        <br />
        透過 Ingestion 或 AI 功能發起對話後，紀錄會自動出現在這裡。
      </p>
    </div>
  );
}

function TranscriptView({ session }: { session: AgentSession }) {
  const totalTokens = session.totalInputTokens + session.totalOutputTokens;
  const turns = session.messages.filter((m) => m.role !== 'system').length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-stone-200/10 px-6 py-4">
        <h2 className="truncate text-sm font-semibold text-stone-100">{session.title}</h2>
        <div className="mt-1 flex items-center gap-4 text-[11px] text-stone-400">
          <span className="flex items-center gap-1">
            <Cpu size={11} />
            {session.model}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {formatTime(session.startedAt)}
          </span>
          <span>{turns} turns</span>
          <span>{formatTokens(totalTokens)} tokens</span>
          <span
            className={[
              'rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wider',
              session.status === 'completed'
                ? 'bg-emerald-900/50 text-emerald-400'
                : session.status === 'error'
                  ? 'bg-red-900/50 text-red-400'
                  : 'bg-amber-900/50 text-amber-400',
            ].join(' ')}
          >
            {session.status}
          </span>
        </div>
        {session.featureId && (
          <p className="mt-0.5 text-[11px] text-stone-500">feature: {session.featureId}</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {session.messages
          .filter((m) => m.role !== 'system')
          .map((msg, i) => (
            <div
              key={i}
              className={['flex gap-3', msg.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'].join(' ')}
            >
              <div
                className={[
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[10px] font-semibold',
                  msg.role === 'assistant'
                    ? 'bg-emerald-900/60 text-emerald-300'
                    : 'bg-stone-700 text-stone-300',
                ].join(' ')}
              >
                {msg.role === 'assistant' ? 'AI' : 'U'}
              </div>
              <div
                className={[
                  'max-w-[78%] rounded-sm px-3 py-2.5 text-[13px] leading-6',
                  msg.role === 'assistant'
                    ? 'bg-[#071d1a]/80 text-stone-200'
                    : 'bg-stone-800/80 text-stone-100',
                ].join(' ')}
              >
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                {(msg.inputTokens || msg.outputTokens) && (
                  <p className="mt-1.5 text-[10px] text-stone-500">
                    {msg.inputTokens ? `in: ${msg.inputTokens}` : ''}
                    {msg.inputTokens && msg.outputTokens ? ' · ' : ''}
                    {msg.outputTokens ? `out: ${msg.outputTokens}` : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-stone-200/10 px-6 py-2.5 text-[11px] text-stone-500">
        共 {session.totalInputTokens.toLocaleString()} input + {session.totalOutputTokens.toLocaleString()} output ={' '}
        {totalTokens.toLocaleString()} tokens
      </div>
    </div>
  );
}

export function SessionsView({ projectRoot }: SessionsViewProps) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sessionsDir = projectRoot ? `${projectRoot}/.project-manager/sessions` : null;

  useEffect(() => {
    if (!sessionsDir) return;
    setLoading(true);
    import('../../../lib/bridge')
      .then(({ listSessions }) => listSessions(sessionsDir))
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionsDir]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const grouped = groupByDate(sessions);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left panel — session list */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-stone-200/10">
        <div className="shrink-0 border-b border-stone-200/10 px-4 py-4">
          <h1 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-stone-50">
            Sessions
          </h1>
          <p className="mt-0.5 text-[11px] text-stone-400">
            {loading ? '載入中…' : `${sessions.length} 筆對話紀錄`}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!loading && sessions.length === 0 && <NoSessions />}
          {Object.entries(grouped).map(([date, group]) => (
            <div key={date}>
              <div className="sticky top-0 bg-[#061512]/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                {date}
              </div>
              {group.map((session) => {
                const isActive = session.id === selectedId;
                const totalTokens = session.totalInputTokens + session.totalOutputTokens;
                const turns = session.messages.filter((m) => m.role !== 'system').length;
                return (
                  <button
                    key={session.id}
                    onClick={() => setSelectedId(session.id)}
                    className={[
                      'group flex w-full items-start gap-2 border-b border-stone-200/5 px-4 py-3 text-left transition-colors',
                      isActive
                        ? 'bg-emerald-950/50'
                        : 'hover:bg-white/[0.03]',
                    ].join(' ')}
                  >
                    <ChevronRight
                      size={12}
                      className={[
                        'mt-1 shrink-0 transition-colors',
                        isActive ? 'text-emerald-400' : 'text-stone-600 group-hover:text-stone-400',
                      ].join(' ')}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={['truncate text-[12px] font-medium', isActive ? 'text-stone-100' : 'text-stone-300'].join(' ')}>
                        {session.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-500">
                        {turns} turns · {formatTokens(totalTokens)} tokens
                      </p>
                      <p className="mt-0.5 text-[10px] text-stone-600">{formatTime(session.startedAt)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* Right panel — transcript */}
      <main className="flex-1 overflow-hidden">
        {selected ? <TranscriptView session={selected} /> : <EmptyState />}
      </main>
    </div>
  );
}
