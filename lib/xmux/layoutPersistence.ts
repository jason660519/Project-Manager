import type {
  Block,
  BlockItem,
  BrowserItem,
  FolderItem,
  LayoutNode,
  SplitNode,
  TerminalItem,
} from '../../components/terminal/blockLayout';

export const XMUX_LAYOUT_STORAGE_KEY = 'pm.xmux.layout.snapshots';
export const XMUX_LAYOUT_STORAGE_VERSION = 1;

interface StoredWorkspaceLayout {
  savedAt: string;
  layout: LayoutNode;
}

interface StoredXmuxLayouts {
  version: typeof XMUX_LAYOUT_STORAGE_VERSION;
  workspaces: Record<string, StoredWorkspaceLayout>;
}

const MAX_LAYOUT_DEPTH = 10;
const MAX_BLOCKS = 32;
const MAX_ITEMS_PER_BLOCK = 24;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteRatio(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.1 && value <= 0.9;
}

function isTerminalItem(value: unknown): value is TerminalItem {
  return (
    isRecord(value) &&
    value.kind === 'terminal' &&
    isString(value.id) &&
    isString(value.label)
  );
}

function isBrowserItem(value: unknown): value is BrowserItem {
  return (
    isRecord(value) &&
    value.kind === 'browser' &&
    isString(value.id) &&
    isString(value.label) &&
    isString(value.url)
  );
}

function isFolderItem(value: unknown): value is FolderItem {
  return (
    isRecord(value) &&
    value.kind === 'folder' &&
    isString(value.id) &&
    isString(value.label) &&
    isString(value.path) &&
    (value.pathError === undefined || isString(value.pathError))
  );
}

function isBlockItem(value: unknown): value is BlockItem {
  return isTerminalItem(value) || isBrowserItem(value) || isFolderItem(value);
}

function isBlock(value: unknown): value is Block {
  if (!isRecord(value) || !isString(value.id) || !isString(value.activeItemId)) {
    return false;
  }
  if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > MAX_ITEMS_PER_BLOCK) {
    return false;
  }
  if (!value.items.every(isBlockItem)) return false;
  return value.items.some((item) => item.id === value.activeItemId);
}

function isSplitDirection(value: unknown): value is SplitNode['direction'] {
  return value === 'vertical' || value === 'horizontal';
}

function isLayoutNode(value: unknown, depth = 0, blockCount = { value: 0 }): value is LayoutNode {
  if (!isRecord(value) || depth > MAX_LAYOUT_DEPTH) return false;

  if (value.type === 'leaf') {
    blockCount.value += 1;
    return blockCount.value <= MAX_BLOCKS && isBlock(value.block);
  }

  if (value.type === 'split') {
    return (
      isString(value.id) &&
      isSplitDirection(value.direction) &&
      isFiniteRatio(value.ratio) &&
      isLayoutNode(value.first, depth + 1, blockCount) &&
      isLayoutNode(value.second, depth + 1, blockCount)
    );
  }

  return false;
}

function readStoredLayouts(): StoredXmuxLayouts | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(XMUX_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== XMUX_LAYOUT_STORAGE_VERSION || !isRecord(parsed.workspaces)) {
      return null;
    }
    const workspaces: Record<string, StoredWorkspaceLayout> = {};
    for (const [workspaceId, entry] of Object.entries(parsed.workspaces)) {
      if (!isRecord(entry) || !isString(entry.savedAt) || !('layout' in entry)) {
        continue;
      }
      workspaces[workspaceId] = {
        savedAt: entry.savedAt,
        layout: entry.layout as LayoutNode,
      };
    }
    return {
      version: XMUX_LAYOUT_STORAGE_VERSION,
      workspaces,
    };
  } catch {
    return null;
  }
}

export function loadPersistedXmuxLayout(workspaceId: string): LayoutNode | null {
  const store = readStoredLayouts();
  const entry = store?.workspaces[workspaceId];
  if (!entry || !isLayoutNode(entry.layout)) return null;
  return entry.layout;
}

export function savePersistedXmuxLayout(workspaceId: string, layout: LayoutNode): boolean {
  if (typeof window === 'undefined' || !isLayoutNode(layout)) return false;

  try {
    const store = readStoredLayouts() ?? {
      version: XMUX_LAYOUT_STORAGE_VERSION,
      workspaces: {},
    };
    const next: StoredXmuxLayouts = {
      version: XMUX_LAYOUT_STORAGE_VERSION,
      workspaces: {
        ...store.workspaces,
        [workspaceId]: {
          savedAt: new Date().toISOString(),
          layout,
        },
      },
    };
    window.localStorage.setItem(XMUX_LAYOUT_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
