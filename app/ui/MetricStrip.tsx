'use client';

import type { ReactNode } from 'react';

export interface MetricItem {
  label: string;
  value: string;
  caption: string;
  icon: ReactNode;
}

interface MetricStripProps {
  items: MetricItem[];
}

export function MetricStrip({ items }: MetricStripProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="border border-stone-200/18 bg-[#08231f]/72">
          <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3">
            <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">{item.label}</h2>
            <div className="text-stone-300/70">{item.icon}</div>
          </div>
          <div className="px-4 py-4">
            <div className="font-mono text-3xl font-semibold text-stone-50">{item.value}</div>
            <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-stone-400">{item.caption}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
