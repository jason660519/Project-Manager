'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { readFile, openPath } from '../../../lib/bridge';

interface FeatureDocPanelProps {
  absPath: string | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Mermaid block — lazy-loads mermaid so it doesn't inflate the initial bundle.
// ---------------------------------------------------------------------------
function MermaidBlock({ code }: { code: string }) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('mermaid').then(({ default: mermaid }) => {
      if (cancelled) return;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: { background: 'transparent', primaryColor: '#6ee7b7', lineColor: '#6ee7b7' },
      });
      mermaid.render(`mg-${id}`, code)
        .then(({ svg }) => {
          if (!cancelled && ref.current) ref.current.innerHTML = svg;
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (error) {
    return (
      <pre className="text-[11px] text-amber-400/80 whitespace-pre-wrap break-all border border-amber-400/20 rounded p-3">
        Mermaid error: {error}
      </pre>
    );
  }
  return <div ref={ref} className="my-3 flex justify-center overflow-x-auto" />;
}

// ---------------------------------------------------------------------------
// Custom code block — routes ```mermaid to MermaidBlock, others to <pre><code>.
// ---------------------------------------------------------------------------
const mdComponents: Components = {
  code({ className, children, ...props }) {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1];
    const isBlock = !props.node?.position || (props.node.position.start.line !== props.node.position.end.line);
    if (lang === 'mermaid' && isBlock) {
      return <MermaidBlock code={String(children).trim()} />;
    }
    return <code className={className} {...props}>{children}</code>;
  },
};

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
export function FeatureDocPanel({ absPath, onClose }: FeatureDocPanelProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!absPath) { setContent(null); setError(null); return; }
    setLoading(true);
    setContent(null);
    setError(null);
    readFile(absPath)
      .then(setContent)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Failed to read file: ${msg}`);
      })
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
              <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
