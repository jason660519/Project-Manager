'use client';

import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { DiscoveryRunSummary } from '../../../../../lib/integrations/discovery/summarize';

export function DiscoveryRunSummaryView({
  summary,
  warnings,
  running,
}: {
  summary: DiscoveryRunSummary | null;
  warnings: string[];
  running: boolean;
}) {
  if (running) {
    return (
      <div className="flex items-start gap-3 border-b border-stone-200/10 px-4 py-6">
        <RefreshCw size={18} className="mt-0.5 shrink-0 animate-spin text-emerald-300" />
        <div>
          <p className="text-sm text-stone-100">Discovery in progress…</p>
          <p className="mt-1 text-xs text-stone-400">
            Passive probes finish in seconds. nmap on a /24 subnet may take up to a minute. Results stay
            on screen until you close this dialog.
          </p>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-4 border-b border-stone-200/10 px-4 py-4">
      <p className="flex items-center gap-2 text-sm text-stone-100">
        {summary.ok ? (
          <CheckCircle2 size={16} className="text-emerald-400" />
        ) : (
          <AlertTriangle size={16} className="text-amber-300" />
        )}
        Discovery complete
        <span className="font-mono text-[10px] text-stone-500">{summary.durationMs}ms</span>
      </p>

      <p className="text-xs leading-relaxed text-stone-300">
        <span className="text-stone-100">{summary.existingInstanceCount}</span> configured instance
        {summary.existingInstanceCount === 1 ? '' : 's'} in inventory before this scan ·{' '}
        <span className="text-emerald-200">{summary.newInstanceCount} new</span> added to the table ·{' '}
        <span className="text-stone-400">{summary.skippedAsExistingCount}</span> probe hit(s) matched
        existing entries
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Hosts (ARP/nmap)" value={summary.deviceCount} />
        <MiniStat label="Docker" value={summary.containerCount} />
        <MiniStat label="Bonjour" value={summary.serviceCount} />
        <MiniStat label="New in table" value={summary.newInstanceCount} accent />
      </div>

      <InstanceSection
        title={`Configured instances (${summary.existingInstanceCount})`}
        emptyHint="No seeded instances in catalog."
        items={summary.existingInstances}
        muted
      />

      <InstanceSection
        title={`New from this scan (${summary.newInstanceCount})`}
        emptyHint="No new rows — target may already be listed above (e.g. living-room-server at 192.168.1.6)."
        items={summary.newInstances}
        highlight
      />

      {summary.skippedAsExistingCount > 0 && (
        <InstanceSection
          title={`Already in inventory (${summary.skippedAsExistingCount})`}
          emptyHint=""
          items={summary.skippedAsExisting}
          muted
        />
      )}

      {warnings.length > 0 && (
        <ul className="max-h-28 overflow-auto border border-amber-400/25 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-100/90">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-stone-500">
        {summary.totalDiscovered} raw probe hit(s) · {new Date(summary.scannedAt).toLocaleString()} · Close
        when you are done reviewing
      </p>
    </div>
  );
}

function InstanceSection({
  title,
  emptyHint,
  items,
  muted,
  highlight,
}: {
  title: string;
  emptyHint: string;
  items: DiscoveryRunSummary['existingInstances'];
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border px-2 py-2 ${
        highlight ? 'border-emerald-400/25 bg-emerald-950/15' : 'border-stone-200/10 bg-stone-950/30'
      }`}
    >
      <p
        className={`text-[10px] font-medium uppercase tracking-[0.1em] ${
          highlight ? 'text-emerald-300/90' : 'text-stone-500'
        }`}
      >
        {title}
      </p>
      {items.length === 0 ? (
        <p className={`mt-1 text-[11px] ${muted ? 'text-stone-500' : 'text-stone-400'}`}>{emptyHint}</p>
      ) : (
        <ul className="mt-1.5 max-h-36 space-y-1 overflow-auto">
          {items.map((item) => (
            <li key={`${item.name}-${item.detail}`} className="text-[11px] text-stone-300">
              <span className="text-stone-100">{item.name}</span>
              <span className="mx-1 text-stone-600">·</span>
              <span className="font-mono text-stone-400">{item.detail}</span>
              <span className="ml-1 text-[10px] uppercase text-stone-500">{item.scanMethod}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="border border-stone-200/10 bg-stone-950/40 px-2 py-2">
      <p className="text-[10px] uppercase tracking-[0.08em] text-stone-500">{label}</p>
      <p className={`font-mono text-lg ${accent ? 'text-emerald-200' : 'text-stone-100'}`}>{value}</p>
    </div>
  );
}
