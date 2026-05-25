'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmbeddedXtermPane } from './EmbeddedXtermPane';
import { PaneShell, type PaneActions, type PaneShellTab } from './PaneShell';

export type { PaneActions } from './PaneShell';
export { PaneActionToolbar } from './PaneShell';

export interface TerminalTab {
  id: string;
  label: string;
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
  actions,
}: {
  paneId: string;
  workspaceId: string;
  cwd: string;
  actions?: PaneActions;
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

  const shellTabs: PaneShellTab[] = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    type: 'terminal',
    active: tab.id === activeTabId,
  }));

  const shellActions: PaneActions = {
    ...(actions ?? {}),
    onAddTerminal: actions?.onAddTerminal ?? onNewTab,
  };

  const sessionKey = `${workspaceId}::${paneId}::${activeTabId}`;

  return (
    <PaneShell
      tabs={shellTabs}
      onSelectTab={onSelectTab}
      onCloseTab={onCloseTab}
      actions={shellActions}
    >
      <EmbeddedXtermPane key={sessionKey} sessionKey={sessionKey} cwd={cwd} />
    </PaneShell>
  );
}
