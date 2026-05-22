'use client';

import type { IntegrationStatus } from '../../../../../lib/integrations/types';

const STATUS_STYLES: Record<IntegrationStatus, string> = {
  installed: 'border-emerald-200/25 bg-emerald-100/12 text-emerald-100',
  connected: 'border-cyan-200/25 bg-cyan-100/12 text-cyan-100',
  running: 'border-emerald-200/25 bg-emerald-100/12 text-emerald-100',
  stopped: 'border-stone-300/25 bg-stone-200/10 text-stone-200',
  warning: 'border-amber-300/30 bg-amber-400/12 text-amber-100',
  unavailable: 'border-red-400/30 bg-red-500/15 text-red-200',
  not_installed: 'border-stone-300/25 bg-stone-200/10 text-stone-200',
  idle: 'border-stone-300/25 bg-stone-200/10 text-stone-200',
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
      className={`inline-flex border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${STATUS_STYLES[status] ?? STATUS_STYLES.idle}`}
    >
      {label}
    </span>
  );
}
