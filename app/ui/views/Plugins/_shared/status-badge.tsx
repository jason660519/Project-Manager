'use client';

import type { IntegrationStatus } from '../../../../../lib/integrations/types';

const STATUS_STYLES: Record<IntegrationStatus, string> = {
  installed: 'border-emerald-400/35 text-emerald-300 bg-emerald-950/30',
  connected: 'border-sky-400/35 text-sky-300 bg-sky-950/30',
  running: 'border-emerald-400/40 text-emerald-200 bg-emerald-900/40',
  stopped: 'border-stone-500/40 text-stone-400 bg-stone-900/40',
  warning: 'border-amber-400/40 text-amber-200 bg-amber-950/30',
  unavailable: 'border-stone-600/50 text-stone-500 bg-stone-900/50',
  not_installed: 'border-stone-500/30 text-stone-400 bg-stone-900/30',
  idle: 'border-stone-600/40 text-stone-500 bg-stone-900/30',
};

export function StatusBadge({
  status,
  label,
}: {
  status: IntegrationStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] ${STATUS_STYLES[status] ?? STATUS_STYLES.idle}`}
    >
      {label}
    </span>
  );
}
