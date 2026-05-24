'use client';

import { useMemo, useState } from 'react';
import { Bot, KeyRound, Loader2, X } from 'lucide-react';
import type { ProjectEntry } from '../../../../lib/types';

interface PostImportScanDialogProps {
  projects: ProjectEntry[];
  onClose: () => void;
  onScanProjects: (projects: ProjectEntry[]) => Promise<void>;
  scanning: boolean;
  /** When true, Scan is disabled and an amber banner points users to Keys. */
  keyMissing?: boolean;
  onOpenKeys?: () => void;
}

export function PostImportScanDialog({
  projects,
  onClose,
  onScanProjects,
  scanning,
  keyMissing = false,
  onOpenKeys,
}: PostImportScanDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(projects.map((p) => p.id)));

  const list = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        name: p.config.project.name,
        root: p.config.project.root,
        configMissing: Boolean(p.configMissing),
      })),
    [projects],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedProjects = projects.filter((p) => selected.has(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg border border-emerald-200/25 bg-[rgb(var(--pm-panel))] shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200/12 px-6 py-4">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-emerald-300" />
            <h3 className="text-base font-semibold text-stone-50">Generate project data?</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={scanning}
            className="text-stone-400 hover:text-stone-100 disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-stone-300">
            Imported {projects.length} folder{projects.length === 1 ? '' : 's'}. The following
            {projects.length === 1 ? ' project has' : ' projects have'} no{' '}
            <code className="font-mono text-stone-200">.project-manager/</code> dashboard folder or an empty feature list.
            Run AI Scan now to generate one?
          </p>
          <ul className="max-h-48 space-y-2 overflow-y-auto border border-stone-200/12 bg-[rgb(var(--pm-input))] p-3">
            {list.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  disabled={scanning}
                  className="mt-0.5 h-3.5 w-3.5 accent-emerald-400"
                />
                <span className="min-w-0">
                  <span className="font-medium text-stone-100">{item.name}</span>
                  {item.configMissing && (
                    <span className="ml-2 border border-amber-200/30 px-1 py-0.5 text-[9px] uppercase tracking-wider text-amber-200">
                      No config
                    </span>
                  )}
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-stone-500">{item.root}</span>
                </span>
              </li>
            ))}
          </ul>
          {keyMissing ? (
            <div className="flex items-start gap-2 border border-amber-200/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
              <KeyRound size={13} className="mt-0.5 shrink-0 text-amber-200" />
              <span>
                AI Scan requires at least one enabled AI provider key. Save one in Keys, then re-open this prompt.
                You can also dismiss and run Scan later from each project row.
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-stone-500">
              You can also run Scan later from each project row. Requires at least one enabled AI provider key in Keys.
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200/12 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={scanning}
            className="border border-stone-200/20 px-4 py-2 text-sm text-stone-200 hover:bg-white/5 disabled:opacity-40"
          >
            Later
          </button>
          {keyMissing && onOpenKeys && (
            <button
              type="button"
              onClick={onOpenKeys}
              disabled={scanning}
              className="flex items-center gap-2 border border-amber-200/40 bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <KeyRound size={14} />
              Open Keys
            </button>
          )}
          <button
            type="button"
            onClick={() => void onScanProjects(selectedProjects)}
            disabled={scanning || selectedProjects.length === 0 || keyMissing}
            title={keyMissing ? 'No enabled AI provider key configured' : undefined}
            className="flex items-center gap-2 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {scanning ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <Bot size={14} />
                Scan selected ({selectedProjects.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
