'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TerminalSlot } from './TerminalSlot';
import { destroy as destroyTerminal } from './TerminalRegistry';
import { PaneShell, type PaneActions, type PaneShellTab } from './PaneShell';
import { BrowserContent } from '../browser/BrowserContent';
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
import { destroyBlockItem } from './destroyBlockItems';

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

  // Lazy-mount: mount a tab the first time it becomes active (or when newly
  // added as the active tab). Once mounted it stays mounted (hidden when
  // inactive) so PTY / native browser state survive tab switches — without
  // eagerly mounting every tab at block creation (which broke 0×0 xterm init,
  // concurrent webview creates, and folder IPC races on smaller machines).
  const [seenItemIds, setSeenItemIds] = useState<Set<string>>(() => {
    const initial =
      block.items.find((item) => item.id === block.activeItemId) ??
      block.items[0];
    return new Set(initial ? [initial.id] : []);
  });
  useEffect(() => {
    setSeenItemIds((prev) => {
      const aliveIds = new Set(block.items.map((item) => item.id));
      const activeId =
        block.activeItemId || block.items[0]?.id || '';
      let changed = false;
      const next = new Set(prev);
      if (activeId && !next.has(activeId)) {
        next.add(activeId);
        changed = true;
      }
      for (const id of prev) {
        if (!aliveIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [block.items, block.activeItemId]);

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
      if (closing) {
        destroyBlockItem(closing);
      }
      if (nextItems.length === 0) {
        for (const item of block.items) {
          if (item.id !== tabId) {
            destroyBlockItem(item);
          }
        }
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

  const closePane = useCallback(() => {
    for (const item of block.items) {
      destroyBlockItem(item);
    }
    onClose();
  }, [block.items, onClose]);

  const actions: PaneActions = useMemo(
    () => ({
      onAddTerminal: addTerminal,
      onAddBrowser: addBrowser,
      onAddFolder: addFolder,
      onSplitRight,
      onSplitDown,
      onClosePane: closePane,
    }),
    [addTerminal, addBrowser, addFolder, onSplitRight, onSplitDown, closePane],
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
      <div className="relative h-full min-h-0 w-full">
      {block.items.map((item) => {
        if (!seenItemIds.has(item.id)) return null;
        const visible = item.id === activeItem?.id;
        return (
          <div
            key={item.id}
            className={
              visible
                ? 'relative z-10 flex h-full min-h-0 flex-col'
                : 'pointer-events-none absolute inset-0 z-0 flex h-full min-h-0 flex-col opacity-0'
            }
            aria-hidden={!visible}
          >
            {isTerminal(item) ? (
              <TerminalSlot itemId={item.id} cwd={cwd} isActive={visible} />
            ) : isBrowser(item) ? (
              <BrowserContent
                itemId={item.id}
                url={item.url}
                homepageUrl={homepageUrl}
                isActive={visible}
                onNavigate={(url) => navigateBrowser(item.id, url)}
              />
            ) : isFolder(item) ? (
              <FolderContent
                itemId={item.id}
                rootPath={item.path}
                isActive={visible}
              />
            ) : null}
          </div>
        );
      })}
      </div>
    </PaneShell>
  );
}
