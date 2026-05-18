'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface FeatureDocPanelProps {
  absPath: string | null;
  onClose: () => void;
}

export function FeatureDocPanel({ absPath, onClose }: FeatureDocPanelProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!absPath) { setContent(null); setError(null); return; }
    setLoading(true);
    setContent(null);
    setError(null);
    import('../../../lib/bridge')
      .then(({ readFile }) => readFile(absPath))
      .then(setContent)
      .catch(() => setError('Failed to read file — Tauri runtime required.'))
      .finally(() => setLoading(false));
  }, [absPath]);

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const filename = absPath?.split('/').slice(-2).join('/') ?? '';

  const openInEditor = async () => {
    if (!absPath) return;
    try {
      const { openPath } = await import('../../../lib/bridge');
      await openPath(absPath);
    } catch { /* web preview — no-op */ }
  };

  return (
    <>
      {/* Backdrop — click to close */}
      {absPath && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={[
          'fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[90vw] flex-col border-l border-stone-200/15 shadow-2xl transition-transform duration-200',
          absPath ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        style={{ background: 'var(--pm-sidebar)' }}
      >
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-200/15 px-4">
          <span className="flex-1 truncate font-mono text-[11px] text-stone-400/80" title={absPath ?? ''}>
            {filename}
          </span>
          <button
            type="button"
            onClick={openInEditor}
            title="Open in editor"
            className="flex h-7 w-7 items-center justify-center rounded border border-stone-200/15 text-stone-400 hover:bg-white/8 hover:text-stone-200 transition-colors"
          >
            <ExternalLink size={12} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="flex h-7 w-7 items-center justify-center rounded border border-stone-200/15 text-stone-400 hover:bg-white/8 hover:text-stone-200 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <p className="text-[12px] text-stone-400 animate-pulse">Loading…</p>
          )}
          {error && (
            <p className="text-[12px] text-amber-400/80">{error}</p>
          )}
          {!loading && !error && content === '' && (
            <p className="text-[12px] text-stone-500/60 italic">
              File preview is only available in the desktop app.
            </p>
          )}
          {content && content.length > 0 && (
            <div className="pm-prose">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
