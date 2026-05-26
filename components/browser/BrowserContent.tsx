'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chrome, ExternalLink, Info } from 'lucide-react';
import { deriveBrowserLabel } from '../terminal/blockLayout';
import { openExternalUrl } from '../../lib/bridge';
import { BrowserSlot } from './BrowserSlot';
import {
  backendKind,
  getEmbedFailure,
  retryNativeEmbed,
  sessionKind,
} from './BrowserRegistry';

export const deriveBrowserTabLabel = deriveBrowserLabel;

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^about:/i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

// localhost / same-origin dev URLs embed cleanly in iframe; remote sites need the
// native Tauri webview (cmux-style) or "open externally" fallback.
function isLikelyEmbeddable(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local')
    ) {
      return true;
    }
    if (u.port === '43187') return true;
    if (typeof window !== 'undefined' && u.host === window.location.host) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function BrowserContent({
  itemId,
  url,
  homepageUrl,
  isActive = true,
  onNavigate,
}: {
  itemId: string;
  url: string;
  homepageUrl: string;
  isActive?: boolean;
  onNavigate: (url: string) => void;
}) {
  const [draftUrl, setDraftUrl] = useState(url);
  const [embedRetryKey, setEmbedRetryKey] = useState(0);

  useEffect(() => {
    setDraftUrl(url);
  }, [itemId, url]);

  const embedFailure = getEmbedFailure(itemId);
  const inTauri = backendKind() === 'tauri';
  const nativeActive = sessionKind(itemId) === 'tauri';

  const showBlockedHint = useMemo(() => {
    if (nativeActive) return false;
    if (inTauri) return true;
    return !isLikelyEmbeddable(url);
  }, [nativeActive, inTauri, url]);

  const hintIsNativeFallback = inTauri && !nativeActive;

  const navigate = () => {
    const next = normalizeUrl(draftUrl);
    if (!next) return;
    setDraftUrl(next);
    onNavigate(next);
  };

  const openExternally = () => {
    const target = normalizeUrl(draftUrl) ?? url;
    void openExternalUrl(target).catch(() => {
      if (typeof window !== 'undefined') {
        window.open(target, '_blank', 'noopener,noreferrer');
      }
    });
  };

  return (
    <div
      data-browser-pane
      className="flex h-full min-h-0 flex-col bg-editor-bg"
    >
      <div
        data-browser-chrome
        className="relative z-[100] flex h-8 shrink-0 items-center gap-2 border-b border-stone-800 bg-editor-bg px-2 text-[11px] text-stone-400"
      >
        <Chrome size={13} className="shrink-0 text-stone-300" />
        <input
          value={draftUrl}
          onChange={(event) => setDraftUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') navigate();
          }}
          placeholder={homepageUrl}
          className="min-w-0 flex-1 bg-editor-addr px-2 py-1 text-stone-200 outline-none ring-1 ring-stone-800 focus:ring-sky-400/50"
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
        <div className="relative z-[100] flex shrink-0 items-center gap-2 border-b border-amber-900/40 bg-amber-950/40 px-2 py-1 text-[11px] text-amber-200">
          <Info size={12} className="shrink-0" />
          <span className="min-w-0 flex-1">
            {hintIsNativeFallback ? (
              <>
                內嵌瀏覽器尚未載入
                {embedFailure ? `（${embedFailure}）` : ''}。請點「重試內嵌」或
              </>
            ) : (
              <>
                此網址無法在瀏覽器預覽中顯示（例如 GitHub、Google）。請用
                <code className="mx-1 text-amber-100">npm run tauri:dev</code>
                或
                <code className="mx-1 text-amber-100">./start_project_manager.sh</code>
                開桌面版，或點
              </>
            )}
          </span>
          {hintIsNativeFallback ? (
            <button
              type="button"
              onClick={() => {
                retryNativeEmbed(itemId, url);
                setEmbedRetryKey((k) => k + 1);
              }}
              className="inline-flex shrink-0 items-center gap-1 border border-amber-600/60 px-1.5 py-0.5 text-amber-100 hover:bg-amber-900/40 hover:text-amber-50"
            >
              重試內嵌
            </button>
          ) : null}
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
      <BrowserSlot
        key={embedRetryKey}
        itemId={itemId}
        url={url}
        isActive={isActive}
      />
    </div>
  );
}
