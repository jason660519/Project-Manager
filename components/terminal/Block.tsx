'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TerminalSlot } from './TerminalSlot';
import { destroy as destroyTerminal } from './TerminalRegistry';
import { PaneShell, type PaneActions, type PaneShellTab } from './PaneShell';
import { BrowserContent } from '../browser/BrowserContent';
import { destroy as destroyBrowser } from '../browser/BrowserRegistry';
import { FolderContent } from '../folder/FolderContent';
import {
  deriveBrowserLabel,
  deriveFolderLabel,
  type Block as BlockModel,
  type BlockItem,
  type BrowserItem,
  type FolderItem,
  type TerminalItem,
} from './blockLayout';

interface BlockProps {
  block: BlockModel;
  workspaceId: string;
  cwd: string;
  homepageUrl: string;
  onUpdate: (updater: (block: BlockModel) => BlockModel) => void;
  onClose: () => void;
  onSplitRight: () => void;
  onSplitDown: () => void;
}

let itemIdCounter = 0;
function nextItemId(prefix: string): string {
  itemIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${itemIdCounter}`;
}

function isTerminal(item: BlockItem): item is TerminalItem {
  return item.kind === 'terminal';
}
function isBrowser(item: BlockItem): item is BrowserItem {
  return item.kind === 'browser';
}
function isFolder(item: BlockItem): item is FolderItem {
  return item.kind === 'folder';
}

export function Block({
  block,
  workspaceId,
  cwd,
  homepageUrl,
  onUpdate,
  onClose,
  onSplitRight,
  onSplitDown,
}: BlockProps) {
  const activeItem =
    block.items.find((item) => item.id === block.activeItemId) ?? block.items[0];

  // Lazy-mount: only mount an item the first time it becomes active. Once
  // mounted, the item stays mounted (hidden via display:none when inactive)
  // so terminal PTY sessions and browser iframe state survive tab switches.
  const [seenItemIds, setSeenItemIds] = useState<Set<string>>(
    () => new Set(block.items.map((item) => item.id)),
  );
  useEffect(() => {
    if (!activeItem) return;
    setSeenItemIds((prev) => {
      if (prev.has(activeItem.id)) return prev;
      const next = new Set(prev);
      next.add(activeItem.id);
      return next;
    });
  }, [activeItem?.id]);
  // Drop ids for items that have been closed so the Set doesn't grow unbounded.
  useEffect(() => {
    setSeenItemIds((prev) => {
      const aliveIds = new Set(block.items.map((item) => item.id));
      for (const id of prev) {
        if (!aliveIds.has(id)) {
          return new Set(Array.from(prev).filter((entry) => aliveIds.has(entry)));
        }
      }
      return prev;
    });
  }, [block.items]);

  const addTerminal = useCallback(() => {
    const nextLabel = `zsh ${block.items.filter(isTerminal).length + 1}`;
    const id = nextItemId('term');
    onUpdate((b) => ({
      ...b,
      items: [...b.items, { kind: 'terminal', id, label: nextLabel }],
      activeItemId: id,
    }));
  }, [block.items, onUpdate]);

  const addBrowser = useCallback(() => {
    const id = nextItemId('browser');
    onUpdate((b) => ({
      ...b,
      items: [
        ...b.items,
        {
          kind: 'browser',
          id,
          label: deriveBrowserLabel(homepageUrl),
          url: homepageUrl,
        },
      ],
      activeItemId: id,
    }));
  }, [homepageUrl, onUpdate]);

  const addFolder = useCallback(() => {
    const id = nextItemId('folder');
    onUpdate((b) => ({
      ...b,
      items: [
        ...b.items,
        {
          kind: 'folder',
          id,
          label: deriveFolderLabel(cwd),
          path: cwd,
        },
      ],
      activeItemId: id,
    }));
  }, [cwd, onUpdate]);

  const selectTab = useCallback(
    (tabId: string) => {
      onUpdate((b) =>
        b.activeItemId === tabId ? b : { ...b, activeItemId: tabId },
      );
    },
    [onUpdate],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      const closing = block.items.find((item) => item.id === tabId);
      const nextItems = block.items.filter((item) => item.id !== tabId);
      // Tell the appropriate registry the user has permanently dismissed this
      // item. Deferred so the React detach (slot unmount) runs first; otherwise
      // we'd remove the host DIV out from under React's commit phase.
      if (closing?.kind === 'terminal') {
        queueMicrotask(() => destroyTerminal(tabId));
      } else if (closing?.kind === 'browser') {
        queueMicrotask(() => destroyBrowser(tabId));
      }
      if (nextItems.length === 0) {
        onClose();
        return;
      }
      const nextActive =
        block.activeItemId === tabId
          ? (nextItems[0]?.id ?? '')
          : block.activeItemId;
      onUpdate((b) => ({ ...b, items: nextItems, activeItemId: nextActive }));
    },
    [block.activeItemId, block.items, onClose, onUpdate],
  );

  const navigateBrowser = useCallback(
    (itemId: string, url: string) => {
      onUpdate((b) => ({
        ...b,
        items: b.items.map((item) =>
          item.id === itemId && isBrowser(item)
            ? { ...item, url, label: deriveBrowserLabel(url) }
            : item,
        ),
      }));
    },
    [onUpdate],
  );

  const actions: PaneActions = useMemo(
    () => ({
      onAddTerminal: addTerminal,
      onAddBrowser: addBrowser,
      onAddFolder: addFolder,
      onSplitRight,
      onSplitDown,
    }),
    [addTerminal, addBrowser, addFolder, onSplitRight, onSplitDown],
  );

  const shellTabs: PaneShellTab[] = block.items.map((item) => ({
    id: item.id,
    label: item.label,
    type: item.kind,
    active: item.id === activeItem?.id,
  }));

  return (
    <PaneShell
      tabs={shellTabs}
      onSelectTab={selectTab}
      onCloseTab={closeTab}
      actions={actions}
    >
      {block.items.map((item) => {
        if (!seenItemIds.has(item.id)) return null;
        const visible = item.id === activeItem?.id;
        return (
          <div
            key={item.id}
            className={visible ? 'flex h-full min-h-0 flex-col' : 'hidden'}
          >
            {isTerminal(item) ? (
              <TerminalSlot itemId={item.id} cwd={cwd} />
            ) : isBrowser(item) ? (
              <BrowserContent
                itemId={item.id}
                url={item.url}
                homepageUrl={homepageUrl}
                onNavigate={(url) => navigateBrowser(item.id, url)}
              />
            ) : isFolder(item) ? (
              <FolderContent itemId={item.id} rootPath={item.path} />
            ) : null}
          </div>
        );
      })}
    </PaneShell>
  );
}
