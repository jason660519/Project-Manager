'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmbeddedXtermPane } from './EmbeddedXtermPane';

export interface TerminalTab {
  id: string;
  label: string;
}

interface PaneTabView {
  id: string;
  label: string;
  active?: boolean;
  icon: 'terminal';
}

function PaneTabs({
  tabs,
  onSelectTab,
  onNewTab,
  onCloseTab,
}: {
  tabs: PaneTabView[];
  onSelectTab: (tabId: string) => void;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center overflow-hidden border-b border-stone-800/90 bg-[#202020]">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={[
            'flex h-8 min-w-0 max-w-[220px] items-center border-r border-stone-800 text-[11px]',
            tab.active ? 'bg-[#232323] text-stone-100' : 'text-stone-400',
          ].join(' ')}
        >
          <button
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className="min-w-0 flex-1 truncate px-2 text-left hover:text-stone-100"
            aria-pressed={tab.active}
          >
            {tab.label}
          </button>
          {tabs.length > 1 ? (
            <button
              type="button"
              onClick={() => onCloseTab(tab.id)}
              className="shrink-0 px-1.5 text-stone-500 hover:bg-white/10 hover:text-stone-200"
              aria-label={`Close ${tab.label}`}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={onNewTab}
        className="h-8 shrink-0 border-r border-stone-800 px-2 text-[11px] text-stone-500 hover:bg-white/5 hover:text-stone-200"
        aria-label="New terminal tab"
      >
        +
      </button>
    </div>
  );
}

function nextTabId(paneId: string, existing: TerminalTab[]): string {
  let index = existing.length + 1;
  let candidate = `${paneId}-tab-${index}`;
  const used = new Set(existing.map((tab) => tab.id));
  while (used.has(candidate)) {
    index += 1;
    candidate = `${paneId}-tab-${index}`;
  }
  return candidate;
}

export function TerminalPaneGroup({
  paneId,
  workspaceId,
  cwd,
}: {
  paneId: string;
  workspaceId: string;
  cwd: string;
}) {
  const seedTab = useMemo(
    () => ({ id: `${paneId}-tab-1`, label: 'zsh' }),
    [paneId],
  );
  const [tabs, setTabs] = useState<TerminalTab[]>([seedTab]);
  const [activeTabId, setActiveTabId] = useState(seedTab.id);

  useEffect(() => {
    setTabs([seedTab]);
    setActiveTabId(seedTab.id);
  }, [workspaceId, seedTab]);

  const onSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const onNewTab = useCallback(() => {
    setTabs((current) => {
      const id = nextTabId(paneId, current);
      const label = `zsh ${current.length + 1}`;
      setActiveTabId(id);
      return [...current, { id, label }];
    });
  }, [paneId]);

  const onCloseTab = useCallback((tabId: string) => {
    setTabs((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((tab) => tab.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[0]?.id ?? '');
      }
      return next;
    });
  }, [activeTabId]);

  const paneTabs: PaneTabView[] = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    icon: 'terminal',
    active: tab.id === activeTabId,
  }));

  const sessionKey = `${workspaceId}::${paneId}::${activeTabId}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaneTabs tabs={paneTabs} onSelectTab={onSelectTab} onNewTab={onNewTab} onCloseTab={onCloseTab} />
      <div className="min-h-0 flex-1">
        <EmbeddedXtermPane key={sessionKey} sessionKey={sessionKey} cwd={cwd} />
      </div>
    </div>
  );
}
