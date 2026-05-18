'use client';

import type { MouseEvent } from 'react';
import { ExternalLink } from 'lucide-react';

export function resolveProjectPath(projectRoot: string, relPath: string): string {
  const root = projectRoot.replace(/\/+$/, '');
  const rel = relPath.replace(/^\/+/, '');
  return `${root}/${rel}`;
}

export function PathLink({
  projectRoot,
  relPath,
}: {
  projectRoot: string;
  relPath?: string;
}) {
  if (!relPath?.trim()) {
    return <span className="text-xs text-stone-500">—</span>;
  }

  const trimmed = relPath.trim();
  const absPath = resolveProjectPath(projectRoot, trimmed);

  const open = async (e: MouseEvent) => {
    e.stopPropagation();
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
      <span className="truncate">{trimmed}</span>
      <ExternalLink size={10} className="shrink-0 opacity-70" />
    </button>
  );
}
