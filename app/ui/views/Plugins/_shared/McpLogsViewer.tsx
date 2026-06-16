'use client';

import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { mcpLogs, mcpLogsDir, onMcpLog, openPath, safeUnlisten, type UnlistenFn } from '../../../../../lib/bridge';
import { useI18n } from '../../../../../lib/i18n';

export function McpLogsViewer({ pluginId, onClose }: { pluginId: string; onClose: () => void }) {
  const { t } = useI18n();
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;

    mcpLogs(pluginId, 500)
      .then((text) => {
        if (cancelled) return;
        setLines(text ? text.split('\n') : []);
      })
      .catch(() => {});

    onMcpLog((p) => {
      if (p.pluginId !== pluginId) return;
      const formatted = `[${p.timestamp}] [${p.level}] ${p.line}`;
      setLines((prev) => (prev.length >= 2000 ? [...prev.slice(-1999), formatted] : [...prev, formatted]));
    })
      .then((fn) => {
        if (cancelled) {
          safeUnlisten(fn);
          return;
        }
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      safeUnlisten(unlisten);
      unlisten = undefined;
    };
  }, [pluginId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200/12 px-6 py-4">
          <h3 className="text-lg font-bold text-stone-50">{t.plugins.mcpLogs}</h3>
          <button type="button" onClick={onClose} className="text-2xl text-stone-400 hover:text-stone-100">
            &times;
          </button>
        </div>
        <div className="max-h-[60vh] min-h-[300px] overflow-auto bg-[rgb(var(--pm-input))] p-3 font-mono text-xs text-stone-200">
          {lines.length === 0 ? (
            <span className="text-stone-500">{t.plugins.noLogLines}</span>
          ) : (
            lines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))
          )}
        </div>
        <div className="flex justify-between border-t border-stone-200/12 px-6 py-4">
          <button
            type="button"
            onClick={() => void mcpLogsDir().then((dir) => openPath(dir))}
            className="flex items-center gap-1.5 border border-stone-200/25 px-3 py-1.5 text-xs text-stone-300"
          >
            <FolderOpen size={12} /> {t.plugins.openLogFolder}
          </button>
          <button type="button" onClick={onClose} className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[rgb(var(--pm-panel))]">
            {t.plugins.close}
          </button>
        </div>
      </div>
    </div>
  );
}
