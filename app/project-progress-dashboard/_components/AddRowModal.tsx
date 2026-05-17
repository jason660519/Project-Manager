'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { FeaturePhase, FeatureStatus } from '../../../lib/types';
import type { CustomProjectProgressRow } from '../types';

interface AddRowModalProps {
  open: boolean;
  onClose: () => void;
  phase: FeaturePhase;
  existingIds: Set<string>;
  onAdd: (row: CustomProjectProgressRow) => void;
}

const PHASE_LABEL: Record<FeaturePhase, string> = {
  development: '開發 Development',
  testing: '測試 Testing',
  deployment: '部署 Deployment',
  operations: '運維 Operations',
};

export function AddRowModal({ open, onClose, phase, existingIds, onAdd }: AddRowModalProps) {
  const [rowId, setRowId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Custom');
  const [percentage, setPercentage] = useState<number>(0);
  const [locatedPage, setLocatedPage] = useState('');
  const [status, setStatus] = useState<FeatureStatus>('todo');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = () => {
    setError(null);
    const id = rowId.trim();
    if (!id) { setError('Row ID is required'); return; }
    if (existingIds.has(id)) { setError(`Row ID "${id}" already exists`); return; }
    if (!name.trim()) { setError('Name is required'); return; }
    const row: CustomProjectProgressRow = {
      rowId: id,
      name: name.trim(),
      category: category.trim() || 'Custom',
      percentage: Math.max(0, Math.min(100, percentage)),
      locatedPage: locatedPage.trim() || undefined,
      status,
      phase,
    };
    onAdd(row);
    setRowId('');
    setName('');
    setCategory('Custom');
    setPercentage(0);
    setLocatedPage('');
    setStatus('todo');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded border border-stone-200/20 bg-[#061512] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-100">
            Add row · {PHASE_LABEL[phase]}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-100"><X size={16} /></button>
        </div>
        <div className="space-y-2 text-xs text-stone-200">
          <Field label="Row ID *">
            <input value={rowId} onChange={(e) => setRowId(e.target.value)}
              placeholder="e.g. C-001"
              className="input" />
          </Field>
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </Field>
          <Field label="Category">
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="input" />
          </Field>
          <Field label="Located Page">
            <input value={locatedPage} onChange={(e) => setLocatedPage(e.target.value)} className="input" placeholder="optional" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as FeatureStatus)} className="input">
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="on_hold">On Hold</option>
              </select>
            </Field>
            <Field label="Progress %">
              <input type="number" min={0} max={100} value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
                className="input" />
            </Field>
          </div>
          {error && <p className="text-[11px] text-red-300">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-stone-200/15 px-3 py-1.5 text-xs text-stone-300">Cancel</button>
          <button onClick={submit} className="rounded bg-emerald-500/30 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/40">
            Add
          </button>
        </div>
      </div>
      <style jsx>{`
        :global(.input) {
          height: 1.75rem;
          width: 100%;
          border-radius: 0.25rem;
          border: 1px solid rgba(231, 229, 228, 0.15);
          background: rgba(6, 21, 18, 0.95);
          padding: 0 0.5rem;
          color: rgb(245, 245, 244);
          font-size: 0.75rem;
        }
        :global(.input:focus) {
          outline: none;
          border-color: rgba(110, 231, 183, 0.4);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">{label}</span>
      {children}
    </label>
  );
}
