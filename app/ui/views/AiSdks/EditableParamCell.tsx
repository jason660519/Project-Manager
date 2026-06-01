'use client';

/**
 * Type-aware editable cell for a single tunable SDK parameter. Renders the
 * input matching the param's type, validates live against the spec, and commits
 * the (optionally clamped) value to the parent on blur. Out-of-range values get
 * a red ring + tooltip; the parent aggregates the error count.
 *
 * Row click handlers live on the <tr>, so every interactive element here calls
 * e.stopPropagation().
 */

import React, { useEffect, useState } from 'react';
import type { ParamSpec, ParamValue } from '../../../../lib/aiSdks/catalog';
import { validateParam } from '../../../../lib/aiSdks/store';

interface EditableParamCellProps {
  spec: ParamSpec;
  value: ParamValue;
  readOnly: boolean;
  onCommit: (value: ParamValue) => void;
}

function toInputString(value: ParamValue): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

const BASE_INPUT =
  'w-full border bg-[rgb(var(--pm-input))] px-2 py-1 text-xs text-stone-200 outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50';

export function EditableParamCell({ spec, value, readOnly, onCommit }: EditableParamCellProps) {
  const [draft, setDraft] = useState<string>(toInputString(value));

  // Re-sync when the external value changes (e.g. restore defaults / import).
  useEffect(() => {
    setDraft(toInputString(value));
  }, [value]);

  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  // ── boolean ─────────────────────────────────────────────────────────────
  if (spec.type === 'boolean') {
    const current = value === true ? 'true' : value === false ? 'false' : '';
    return (
      <select
        value={current}
        disabled={readOnly}
        aria-label={spec.label}
        onClick={stop}
        onChange={(e) => {
          stop(e);
          onCommit(e.target.value === '' ? null : e.target.value === 'true');
        }}
        className={`${BASE_INPUT} border-stone-200/18 focus:ring-emerald-400/50`}
      >
        <option value="" className="bg-stone-900">—</option>
        <option value="true" className="bg-stone-900">true</option>
        <option value="false" className="bg-stone-900">false</option>
      </select>
    );
  }

  // ── enum ────────────────────────────────────────────────────────────────
  if (spec.type === 'enum') {
    return (
      <select
        value={typeof value === 'string' ? value : ''}
        disabled={readOnly}
        aria-label={spec.label}
        onClick={stop}
        onChange={(e) => {
          stop(e);
          onCommit(e.target.value === '' ? null : e.target.value);
        }}
        className={`${BASE_INPUT} border-stone-200/18 focus:ring-emerald-400/50`}
      >
        <option value="" className="bg-stone-900">—</option>
        {(spec.enumValues ?? []).map((opt) => (
          <option key={opt} value={opt} className="bg-stone-900">{opt}</option>
        ))}
      </select>
    );
  }

  // ── number / integer / string ─────────────────────────────────────────────
  const numeric = spec.type === 'number' || spec.type === 'integer';
  const parsed: ParamValue = numeric
    ? draft.trim() === '' ? null : Number(draft)
    : draft;
  const result = validateParam(spec, parsed);
  const invalid = !result.ok;

  const commit = () => {
    if (numeric) {
      if (draft.trim() === '') {
        onCommit(null);
        return;
      }
      const num = Number(draft);
      if (!Number.isFinite(num)) {
        onCommit(null);
        setDraft('');
        return;
      }
      const res = validateParam(spec, num);
      const next = res.clamped !== undefined ? res.clamped : num;
      onCommit(next);
      setDraft(toInputString(next));
      return;
    }
    onCommit(draft);
  };

  return (
    <input
      type={numeric ? 'number' : 'text'}
      inputMode={numeric ? 'decimal' : undefined}
      min={spec.min}
      max={spec.max}
      step={spec.step}
      value={draft}
      disabled={readOnly}
      aria-label={spec.label}
      aria-invalid={invalid}
      title={invalid ? result.message : undefined}
      placeholder={spec.default === null ? '—' : String(spec.default)}
      onClick={stop}
      onChange={(e) => {
        stop(e);
        setDraft(e.target.value);
      }}
      onBlur={commit}
      className={`${BASE_INPUT} ${
        invalid
          ? 'border-rose-400/70 text-rose-200 focus:ring-rose-400/60'
          : 'border-stone-200/18 focus:ring-emerald-400/50'
      } font-mono`}
    />
  );
}
