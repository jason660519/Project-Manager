'use client';

import { useMemo, useRef } from 'react';
import { Chrome, ExternalLink, Info } from 'lucide-react';
import { deriveBrowserLabel } from '../terminal/blockLayout';
import { openExternalUrl } from '../../lib/bridge';
import { BrowserSlot } from './BrowserSlot';
import { backendKind } from './BrowserRegistry';

export const deriveBrowserTabLabel = deriveBrowserLabel;

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^about:/i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

// localhost / 127.* / our own dev host won't set X-Frame-Options, so we don't
// need the "may be blank" warning. Everything else: warn the user that the
// remote site may refuse iframe embedding.
function isLikelyEmbeddable(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local')
    );
  } catch {
    return true;
  }
}

export function BrowserContent({
  itemId,
  url,
  homepageUrl,
  onNavigate,
}: {
  itemId: string;
  url: string;
  homepageUrl: string;
  onNavigate: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Native Tauri webview overlay embeds any URL (X-Frame-Options doesn't
  // apply); only the iframe fallback ever needs the "may be blank" warning.
  const showBlockedHint = useMemo(
    () => backendKind() === 'iframe' && !isLikelyEmbeddable(url),
    [url],
  );

  const navigate = () => {
    const value = inputRef.current?.value ?? '';
    const next = normalizeUrl(value);
    if (!next) return;
    if (inputRef.current) inputRef.current.value = next;
    onNavigate(next);
  };

  const openExternally = () => {
    void openExternalUrl(url).catch(() => {
      // Last-resort fallback: try a plain window.open in case the bridge
      // policy denies the URL (e.g., file:// or chrome-internal scheme).
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1e1e1e]">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-stone-800 px-2 text-[11px] text-stone-400">
        <Chrome size={13} className="shrink-0 text-stone-300" />
        <input
          key={itemId}
          ref={inputRef}
          defaultValue={url}
          onKeyDown={(event) => {
            if (event.key === 'Enter') navigate();
          }}
          placeholder={homepageUrl}
          className="min-w-0 flex-1 bg-[#151515] px-2 py-1 text-stone-200 outline-none ring-1 ring-stone-800 focus:ring-sky-400/50"
          aria-label="Browser URL"
        />
        <button
          type="button"
          onClick={navigate}
          className="shrink-0 border border-stone-700 px-2 py-1 text-stone-300 hover:border-stone-500 hover:text-stone-100"
        >
          Go
        </button>
        <button
          type="button"
          onClick={openExternally}
          className="flex h-6 w-6 shrink-0 items-center justify-center border border-stone-700 text-stone-300 hover:border-stone-500 hover:text-stone-100"
          aria-label="Open browser URL externally"
          title="Open in system browser"
        >
          <ExternalLink size={12} />
        </button>
      </div>
      {showBlockedHint ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-900/40 bg-amber-950/40 px-2 py-1 text-[11px] text-amber-200">
          <Info size={12} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            部分站台拒絕被 iframe 嵌入；若下方頁面空白，請改用
          </span>
          <button
            type="button"
            onClick={openExternally}
            className="inline-flex shrink-0 items-center gap-1 border border-amber-600/60 px-1.5 py-0.5 text-amber-100 hover:bg-amber-900/40 hover:text-amber-50"
          >
            <ExternalLink size={10} />
            系統瀏覽器開啟
          </button>
        </div>
      ) : null}
      <BrowserSlot itemId={itemId} url={url} />
    </div>
  );
}
