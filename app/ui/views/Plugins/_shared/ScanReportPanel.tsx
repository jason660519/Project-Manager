'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, MinusCircle, PlusCircle, RefreshCw, X, XCircle } from 'lucide-react';
import type { IntegrationRow } from '../../../../../lib/integrations/types';
import {
  isOutcomeChanged,
  isOutcomeFailure,
  isOutcomeSkipped,
  splitSystemCliNoise,
  type ScanOutcome,
  type ScanReport,
} from '../../../../../lib/integrations/scan-diff';

interface ScanReportPanelProps {
  report: ScanReport | null;
  /** When true, the global "Scan All" is still running — show a busy bar. */
  running: boolean;
  onClose: () => void;
}

export function ScanReportPanel({ report, running, onClose }: ScanReportPanelProps) {
  const summary = useMemo(() => {
    if (!report) return null;
    let added = 0;
    let removed = 0;
    let updated = 0;
    let failed = 0;
    let skipped = 0;
    let changed = 0;
    for (const o of report.outcomes) {
      added += o.added.length;
      removed += o.removed.length;
      updated += o.updated.length;
      if (isOutcomeFailure(o)) failed += 1;
      else if (isOutcomeSkipped(o)) skipped += 1;
      else if (isOutcomeChanged(o)) changed += 1;
    }
    return { added, removed, updated, failed, skipped, changed };
  }, [report]);

  if (!report && !running) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] max-w-[95vw] border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl">
      <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3">
        <div className="flex items-center gap-2">
          <RefreshCw
            size={14}
            className={`text-emerald-300 ${running ? 'animate-spin' : ''}`}
          />
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-100">
            {running ? 'Scanning…' : 'Scan report'}
          </h3>
          {report && (
            <span className="font-mono text-[10px] text-stone-500">
              {report.durationMs}ms
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-stone-500 hover:text-stone-200"
          aria-label="Close scan report"
        >
          <X size={14} />
        </button>
      </div>

      {summary && (
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-200/10 px-4 py-2 text-[11px] text-stone-300">
          <span className="flex items-center gap-1">
            <PlusCircle size={12} className="text-emerald-300" />
            <span className="font-mono">+{summary.added}</span>
          </span>
          <span className="flex items-center gap-1">
            <MinusCircle size={12} className="text-red-300" />
            <span className="font-mono">−{summary.removed}</span>
          </span>
          <span className="flex items-center gap-1 text-amber-200">
            <RefreshCw size={11} />
            <span className="font-mono">~{summary.updated}</span>
          </span>
          {summary.failed > 0 && (
            <span className="flex items-center gap-1 text-red-300">
              <XCircle size={12} />
              <span className="font-mono">{summary.failed} failed</span>
            </span>
          )}
          {summary.skipped > 0 && (
            <span className="flex items-center gap-1 text-stone-400">
              <AlertTriangle size={11} />
              <span className="font-mono">{summary.skipped} skipped</span>
            </span>
          )}
          {summary.changed === 0 && summary.failed === 0 && summary.skipped === 0 && (
            <span className="flex items-center gap-1 text-emerald-300">
              <CheckCircle2 size={12} />
              No changes
            </span>
          )}
        </div>
      )}

      <div className="max-h-[55vh] overflow-y-auto">
        {report?.outcomes.map((outcome) => (
          <OutcomeRow key={outcome.sheetId} outcome={outcome} />
        ))}
      </div>
    </div>
  );
}

function OutcomeRow({ outcome }: { outcome: ScanOutcome }) {
  const failure = isOutcomeFailure(outcome);
  const skipped = isOutcomeSkipped(outcome);
  const changed = isOutcomeChanged(outcome);
  const noChange = !failure && !skipped && !changed;

  return (
    <div className="border-b border-stone-200/8 px-4 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {failure ? (
            <XCircle size={13} className="text-red-300" />
          ) : skipped ? (
            <AlertTriangle size={13} className="text-amber-300" />
          ) : (
            <CheckCircle2 size={13} className="text-emerald-300" />
          )}
          <span className="text-xs font-medium text-stone-100">{outcome.label}</span>
          {!failure && !skipped && (
            <span className="font-mono text-[10px] text-stone-500">{outcome.count} rows</span>
          )}
        </div>
        <span className="font-mono text-[10px] text-stone-500">{outcome.durationMs}ms</span>
      </div>

      {failure && (
        <p className="mt-1 text-[11px] text-red-300">{outcome.error}</p>
      )}
      {skipped && (
        <p className="mt-1 text-[11px] text-amber-200">{outcome.skipped}</p>
      )}
      {noChange && !failure && !skipped && (
        <p className="mt-0.5 text-[11px] text-stone-500">No changes detected.</p>
      )}

      {changed && (
        <div className="mt-1 space-y-1">
          <ChangeList kind="added" rows={outcome.added} />
          <ChangeList kind="removed" rows={outcome.removed} />
          <ChangeList kind="updated" rows={outcome.updated} />
        </div>
      )}
    </div>
  );
}

function ChangeList({
  kind,
  rows,
}: {
  kind: 'added' | 'removed' | 'updated';
  rows: IntegrationRow[];
}) {
  if (rows.length === 0) return null;
  const { named, systemCliCount } = splitSystemCliNoise(rows);
  if (named.length === 0 && systemCliCount === 0) return null;

  const color =
    kind === 'added'
      ? 'text-emerald-300'
      : kind === 'removed'
        ? 'text-red-300'
        : 'text-amber-200';
  const prefix = kind === 'added' ? '+' : kind === 'removed' ? '−' : '~';
  const verb = kind === 'added' ? 'added' : kind === 'removed' ? 'removed' : 'updated';

  return (
    <div className={`text-[11px] ${color}`}>
      <span className="font-mono">{prefix}</span>{' '}
      {named.slice(0, 6).map((row, idx) => (
        <span key={row.rowKey}>
          {idx > 0 && ', '}
          {row.name}
        </span>
      ))}
      {named.length > 6 && <span> and {named.length - 6} more</span>}
      {systemCliCount > 0 && (
        <span className="ml-1 text-stone-400">
          {named.length > 0 ? ' · ' : ''}
          {systemCliCount} system CLI{systemCliCount === 1 ? '' : 's'} {verb}
        </span>
      )}
    </div>
  );
}
