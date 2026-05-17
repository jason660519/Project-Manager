'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';
import type { Feature, FeaturePhase, ProjectConfig } from '../../../lib/types';
import type { CustomProjectProgressRow } from '../types';
import { buildProgressSnapshot, snapshotToJSON } from '../_lib/exportProgress';

interface ExportProgressDialogProps {
  open: boolean;
  onClose: () => void;
  project: ProjectConfig;
  features: Feature[];
  customRowsByPhase: Record<FeaturePhase, CustomProjectProgressRow[]>;
}

export function ExportProgressDialog({
  open, onClose, project, features, customRowsByPhase,
}: ExportProgressDialogProps) {
  const [copied, setCopied] = useState(false);

  const json = useMemo(() => {
    if (!open) return '';
    return snapshotToJSON(buildProgressSnapshot(project, features, customRowsByPhase));
  }, [open, project, features, customRowsByPhase]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable in some webviews */
    }
  };

  const download = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `progress-${project.name.replace(/\s+/g, '_')}-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded border border-stone-200/20 bg-[#061512] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-100">
            Export progress snapshot
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-100"><X size={16} /></button>
        </div>
        <p className="mb-2 text-[11px] text-stone-400">
          JSON snapshot of all four phases including aggregates and the rows shown on screen.
          Use it for VIS, downstream reports, or cross-tool sync.
        </p>
        <textarea
          value={json}
          readOnly
          className="h-80 w-full resize-none rounded border border-stone-200/15 bg-[#020a09]/90 p-3 font-mono text-[11px] text-stone-200 focus:outline-none"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={copy}
            className="flex h-7 items-center gap-1 rounded border border-stone-200/15 px-2 text-xs text-stone-200 hover:text-stone-100"
          >
            {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={download}
            className="flex h-7 items-center gap-1 rounded bg-emerald-500/30 px-2 text-xs text-emerald-100 hover:bg-emerald-500/40"
          >
            <Download size={12} /> Download
          </button>
        </div>
      </div>
    </div>
  );
}
