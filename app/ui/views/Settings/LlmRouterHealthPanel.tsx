'use client';

// @table-classification: simple
// @table-reason: Read-only LLM router SLI health dashboard — small deployment row set,
//   alias selector + refresh only; no column freeze, filters, or editable cells.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, RefreshCw } from 'lucide-react';

import { readLlmRouterHealth } from '../../../../lib/bridge';
import { useI18n } from '../../../../lib/i18n';
import {
  buildLlmRouterHealthRows,
  getSloForAlias,
  type LlmRouterHealthRow,
  type SloGateStatus,
} from '../../../../lib/llm-router';

const TASK_ALIASES = ['pm-fast', 'pm-code', 'pm-reasoning', 'pm-local'] as const;

function gateTone(status: SloGateStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'open') return 'success';
  if (status === 'closed') return 'warning';
  return 'neutral';
}

function gateLabel(status: SloGateStatus, t: ReturnType<typeof useI18n>['t']): string {
  if (status === 'open') return t.settingsView.llmRouterHealthGateOpen;
  if (status === 'closed') return t.settingsView.llmRouterHealthGateClosed;
  return t.settingsView.llmRouterHealthGateCold;
}

function healthTone(score: number): 'success' | 'warning' | 'neutral' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'neutral';
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function HealthBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'success' | 'warning' | 'neutral';
}) {
  const toneClass = {
    success: 'border-emerald-300/25 bg-emerald-500/15 text-emerald-300',
    warning: 'border-amber-200/25 bg-amber-100/10 text-amber-100/85',
    neutral: 'border-stone-300/20 bg-stone-500/15 text-stone-300',
  }[tone];

  return (
    <span
      className={`inline-flex items-center border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}
    >
      {children}
    </span>
  );
}

function HealthRow({ row, alias }: { row: LlmRouterHealthRow; alias: string }) {
  const { t } = useI18n();
  const slo = getSloForAlias(alias);

  return (
    <tr className="border-b border-stone-200/10 hover:bg-white/[0.045]">
      <td className="px-4 py-3 align-top">
        <div className="text-sm font-medium text-stone-100">{row.providerId}</div>
        <div className="mt-1 font-mono text-[11px] text-stone-400">{row.model}</div>
      </td>
      <td className="px-4 py-3 align-top font-mono text-xs text-stone-300">{row.sampleCount}</td>
      <td className="px-4 py-3 align-top font-mono text-xs text-stone-300">
        {row.p95LatencyMs > 0 ? `${row.p95LatencyMs} ms` : '—'}
        <div className="mt-1 text-[10px] text-stone-500">
          {t.settingsView.llmRouterHealthSloP95.replace('{ms}', String(slo.maxP95LatencyMs))}
        </div>
      </td>
      <td className="px-4 py-3 align-top font-mono text-xs text-stone-300">
        {row.sampleCount > 0 ? formatPercent(row.errorRate) : '—'}
      </td>
      <td className="px-4 py-3 align-top">
        <HealthBadge tone={healthTone(row.healthScore)}>{row.healthScore}</HealthBadge>
      </td>
      <td className="px-4 py-3 align-top">
        <HealthBadge tone={gateTone(row.sloGate)}>{gateLabel(row.sloGate, t)}</HealthBadge>
      </td>
      <td className="px-4 py-3 align-top font-mono text-[11px] text-stone-400">
        {row.lastTtftMs != null ? `TTFT ${row.lastTtftMs} ms` : row.lastLatencyMs != null ? `E2E ${row.lastLatencyMs} ms` : '—'}
      </td>
    </tr>
  );
}

export function LlmRouterHealthPanel({ isTauri }: { isTauri: boolean }) {
  const { t } = useI18n();
  const [alias, setAlias] = useState<(typeof TASK_ALIASES)[number]>('pm-fast');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownCount, setCooldownCount] = useState(0);
  const [fetchedAtUnix, setFetchedAtUnix] = useState<number | null>(null);
  const [rows, setRows] = useState<LlmRouterHealthRow[]>([]);

  const refresh = useCallback(async () => {
    if (!isTauri) return;
    setLoading(true);
    setError(null);
    try {
      const snapshot = await readLlmRouterHealth();
      if (!snapshot) {
        setRows([]);
        setCooldownCount(0);
        setFetchedAtUnix(null);
        return;
      }
      const nextRows = buildLlmRouterHealthRows({
        deployments: snapshot.deployments,
        alias,
        nowUnix: snapshot.fetchedAtUnix,
      });
      setRows(nextRows);
      setCooldownCount(snapshot.cooldownCount);
      setFetchedAtUnix(snapshot.fetchedAtUnix);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [alias, isTauri]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fetchedLabel = useMemo(() => {
    if (!fetchedAtUnix) return null;
    return new Date(fetchedAtUnix * 1000).toLocaleString();
  }, [fetchedAtUnix]);

  if (!isTauri) {
    return (
      <div className="border-t border-stone-200/10 px-4 py-3 text-[11px] text-amber-100/70">
        {t.settingsView.llmRouterHealthRequiresTauri}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-stone-200/12 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
            {t.settingsView.llmRouterHealthAliasLabel}
          </label>
          <select
            value={alias}
            onChange={(event) => setAlias(event.target.value as (typeof TASK_ALIASES)[number])}
            className="border border-stone-200/20 bg-[rgb(var(--pm-input))] px-2 py-1 text-xs text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
          >
            {TASK_ALIASES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {fetchedLabel && (
            <span className="font-mono text-[10px] text-stone-500">
              {t.settingsView.llmRouterHealthFetchedAt.replace('{time}', fetchedLabel)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HealthBadge tone={cooldownCount > 0 ? 'warning' : 'neutral'}>
            {t.settingsView.llmRouterHealthCooldowns.replace('{count}', String(cooldownCount))}
          </HealthBadge>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 border border-stone-300/20 bg-stone-900/20 px-2.5 text-xs font-medium text-stone-300 transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-300/35 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
            {t.settingsView.llmRouterHealthRefresh}
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-stone-200/10 px-4 py-2 text-[11px] text-amber-100/80">{error}</div>
      )}

      <div className="pm-scroll overflow-x-auto bg-transparent">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead className="sticky top-0 z-40 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                {t.settingsView.llmRouterHealthColDeployment}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                {t.settingsView.llmRouterHealthColSamples}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                {t.settingsView.llmRouterHealthColP95}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                {t.settingsView.llmRouterHealthColErrorRate}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                {t.settingsView.llmRouterHealthColScore}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                {t.settingsView.llmRouterHealthColGate}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                {t.settingsView.llmRouterHealthColLastProbe}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <HealthRow key={row.deploymentId} row={row} alias={alias} />
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-stone-500">
                  {t.settingsView.llmRouterHealthEmpty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
