'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { readFile, openPath } from '../lib/bridge';
import MermaidBlock from './MermaidBlock';

interface PluginGuidePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const mdComponents: Components = {
  code({ className, children, ...props }) {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1];
    const isBlock = !props.node?.position || (props.node.position.start.line !== props.node.position.end.line);
    if (lang === 'mermaid' && isBlock) {
      return <MermaidBlock code={String(children).trim()} />;
    }
    if (isBlock && lang) {
      return (
        <pre className="rounded border border-stone-200/10 bg-black/30 px-3 py-2 text-[11px] overflow-x-auto my-2 font-mono">
          <code className={className}>{children}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px] text-amber-300/90" {...props}>
        {children}
      </code>
    );
  },
};

export default function PluginGuidePanel({ isOpen, onClose }: PluginGuidePanelProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guidePath, setGuidePath] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setContent(null);
    setError(null);
    void (async () => {
      try {
        const { getProjectManagerRoot } = await import('../lib/bridge');
        const root = (await getProjectManagerRoot()).replace(/\/+$/, '');
        const resolved = root ? `${root}/docs/engineering/plugin-guide.md` : '';
        if (!cancelled) setGuidePath(resolved);
        if (!resolved) throw new Error('Missing Project Manager root');
        const next = await readFile(resolved);
        if (!cancelled) setContent(next);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(`Failed to read plugin-guide.md: ${msg}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Keyboard close on Esc
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const openInEditor = async () => {
    if (!guidePath) return;
    try {
      await openPath(guidePath);
    } catch { /* no-op in web */ }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={[
          'fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[90vw] flex-col border-l border-stone-200/15 shadow-2xl transition-transform duration-200',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        style={{ background: 'var(--pm-sidebar)' }}
      >
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-200/15 px-4">
          <span className="flex-1 truncate font-mono text-[11px] text-stone-400/80">
            plugin-guide.md
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
