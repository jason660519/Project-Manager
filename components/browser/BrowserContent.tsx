'use client';

import { useRef } from 'react';
import { Chrome, ExternalLink } from 'lucide-react';
import { deriveBrowserLabel } from '../terminal/blockLayout';

export const deriveBrowserTabLabel = deriveBrowserLabel;

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^about:/i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
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

  const navigate = () => {
    const value = inputRef.current?.value ?? '';
    const next = normalizeUrl(value);
    if (!next) return;
    if (inputRef.current) inputRef.current.value = next;
    onNavigate(next);
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
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex h-6 w-6 shrink-0 items-center justify-center border border-stone-700 text-stone-300 hover:border-stone-500 hover:text-stone-100"
          aria-label="Open browser URL externally"
        >
          <ExternalLink size={12} />
        </a>
      </div>
      <iframe
        key={itemId}
        src={url}
        title="xmux browser pane"
        className="min-h-0 flex-1 border-0 bg-white"
      />
    </div>
  );
}
