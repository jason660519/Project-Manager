'use client';

import type { MouseEvent } from 'react';
import { ExternalLink, FileText } from 'lucide-react';

export function resolveProjectPath(projectRoot: string, relPath: string): string {
  const root = projectRoot.replace(/\/+$/, '');
  const rel = relPath.replace(/^\/+/, '');
  return `${root}/${rel}`;
}

function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path.trim());
}

export function PathLink({
  projectRoot,
  relPath,
  label,
  onOpenPanel,
}: {
  projectRoot: string;
  relPath?: string;
  label?: string;
  onOpenPanel?: (absPath: string) => void;
}) {
  if (!relPath?.trim()) {
    return <span className="text-xs text-stone-500">—</span>;
  }

  const trimmed = relPath.trim();
  const absPath = resolveProjectPath(projectRoot, trimmed);
  const opensInPanel = isMarkdownPath(trimmed) && onOpenPanel;

  const open = async (e: MouseEvent) => {
    e.stopPropagation();
    if (opensInPanel) {
      opensInPanel(absPath);
      return;
    }

    try {
      const { openPath } = await import('../../../lib/bridge');
      await openPath(absPath);
    } catch {
      /* Web preview — link is display-only */
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => void open(e)}
      title={absPath}
      className="inline-flex max-w-[180px] items-center gap-1 truncate font-mono text-[11px] text-cyan-200/90 underline decoration-cyan-200/30 underline-offset-2 hover:text-cyan-100 hover:decoration-cyan-100/50"
    >
      <span className="truncate">{label ?? trimmed.split('/').filter(Boolean).pop() ?? trimmed}</span>
      {opensInPanel ? (
        <FileText size={10} className="shrink-0 opacity-70" />
      ) : (
        <ExternalLink size={10} className="shrink-0 opacity-70" />
      )}
    </button>
  );
}
