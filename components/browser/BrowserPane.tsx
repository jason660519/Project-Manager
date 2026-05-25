'use client';

import { useRef } from 'react';
import { Chrome, ExternalLink } from 'lucide-react';
import { PaneShell, type PaneActions, type PaneShellTab } from '../terminal/PaneShell';

export interface BrowserTab {
  id: string;
  label: string;
  url: string;
}

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^about:/i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function deriveLabel(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname) return u.hostname.replace(/^www\./, '');
    return url;
  } catch {
    return url;
  }
}

export function BrowserPane({
  tabs,
  activeTabId,
  homepageUrl,
  onSelectTab,
  onCloseTab,
  onNavigate,
  actions,
}: {
  tabs: BrowserTab[];
  activeTabId: string;
  homepageUrl: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNavigate: (tabId: string, url: string) => void;
  actions: PaneActions;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  const shellTabs: PaneShellTab[] = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    type: 'browser',
    active: tab.id === activeTab?.id,
  }));

  const navigate = () => {
    if (!activeTab) return;
    const value = inputRef.current?.value ?? '';
    const next = normalizeUrl(value);
    if (!next) return;
    if (inputRef.current) inputRef.current.value = next;
    onNavigate(activeTab.id, next);
  };

  if (!activeTab) {
    return (
      <PaneShell tabs={[]} onSelectTab={onSelectTab} actions={actions}>
        <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-stone-500">
          No browser tab
        </div>
      </PaneShell>
    );
  }

  return (
    <PaneShell
      tabs={shellTabs}
      onSelectTab={onSelectTab}
      onCloseTab={onCloseTab}
      actions={actions}
    >
      <div className="flex h-full min-h-0 flex-col bg-[#1e1e1e]">
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-stone-800 px-2 text-[11px] text-stone-400">
          <Chrome size={13} className="shrink-0 text-stone-300" />
          <input
            key={activeTab.id}
            ref={inputRef}
            defaultValue={activeTab.url}
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
            href={activeTab.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-6 w-6 shrink-0 items-center justify-center border border-stone-700 text-stone-300 hover:border-stone-500 hover:text-stone-100"
            aria-label="Open browser URL externally"
          >
            <ExternalLink size={12} />
          </a>
        </div>
        <iframe
          key={activeTab.id}
          src={activeTab.url}
          title="xmux browser pane"
          className="min-h-0 flex-1 border-0 bg-white"
        />
      </div>
    </PaneShell>
  );
}

export { deriveLabel as deriveBrowserTabLabel };
