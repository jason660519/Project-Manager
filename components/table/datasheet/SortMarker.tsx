'use client';

import React from 'react';

/**
 * Company-standard sort affordance (table-governance.md §2.10): default double
 * arrow, up = ascending, down = descending. Render only for sortable columns.
 */
export function SortMarker({ value }: { value: false | 'asc' | 'desc' }) {
  if (value === 'asc') return <span className="text-emerald-200">↑</span>;
  if (value === 'desc') return <span className="text-emerald-200">↓</span>;
  return <span className="text-stone-600">⇅</span>;
}
