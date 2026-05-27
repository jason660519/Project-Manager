// Tree-based tiling layout for the xmux workspace.
//
// A workspace's content area is a binary tree:
//   - LeafNode  holds a Block (a single tabbed pane with terminals/browsers)
//   - SplitNode holds two child nodes side-by-side or stacked
//
// All operations are pure: they return a new tree (or null if the tree
// becomes empty after a removal). Callers are expected to call `setState`
// with the result.

export type TerminalItem = {
  kind: 'terminal';
  id: string;
  label: string;
};

export type BrowserItem = {
  kind: 'browser';
  id: string;
  label: string;
  url: string;
};

export type FolderItem = {
  kind: 'folder';
  id: string;
  label: string;
  path: string;
  pathError?: string;
};

export type BlockItem = TerminalItem | BrowserItem | FolderItem;

export type Block = {
  id: string;
  items: BlockItem[];
  activeItemId: string;
};

export type LeafNode = {
  type: 'leaf';
  block: Block;
};

export type SplitDirection = 'vertical' | 'horizontal';

export type SplitNode = {
  type: 'split';
  id: string;
  direction: SplitDirection;
  ratio: number;
  first: LayoutNode;
  second: LayoutNode;
};

export type LayoutNode = LeafNode | SplitNode;

let idCounter = 0;
function uniqueId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function deriveBrowserLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

export function createTerminalItem(label: string = 'zsh'): TerminalItem {
  return { kind: 'terminal', id: uniqueId('term'), label };
}

export function createBrowserItem(url: string, label?: string): BrowserItem {
  return {
    kind: 'browser',
    id: uniqueId('browser'),
    label: label ?? deriveBrowserLabel(url),
    url,
  };
}

export function deriveFolderLabel(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  const last = idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
  return last || '/';
}

export function createFolderItem(path: string, label?: string, pathError?: string): FolderItem {
  return {
    kind: 'folder',
    id: uniqueId('folder'),
    label: label ?? deriveFolderLabel(path),
    path,
    pathError,
  };
}

export function createBlock(seed?: BlockItem): Block {
  const item = seed ?? createTerminalItem();
  return { id: uniqueId('block'), items: [item], activeItemId: item.id };
}

// First-time layout for a workspace: project folder, browser, and terminal are
// all visible without hunting through tabs.
export function createInitialLayout(
  homepageUrl: string,
  projectRootPath: string = '',
  projectRootPathError?: string,
): LayoutNode {
  const folderBlock = createBlock(
    createFolderItem(projectRootPath, undefined, projectRootPathError),
  );
  const browserBlock = createBlock(createBrowserItem(homepageUrl));
  const terminalBlock = createBlock(createTerminalItem());

  return {
    type: 'split',
    id: uniqueId('split'),
    direction: 'vertical',
    ratio: 0.28,
    first: { type: 'leaf', block: folderBlock },
    second: {
      type: 'split',
      id: uniqueId('split'),
      direction: 'vertical',
      ratio: 0.58,
      first: { type: 'leaf', block: browserBlock },
      second: { type: 'leaf', block: terminalBlock },
    },
  };
}

export function splitLeaf(
  tree: LayoutNode,
  targetBlockId: string,
  direction: SplitDirection,
  newBlock: Block,
): LayoutNode {
  if (tree.type === 'leaf') {
    if (tree.block.id !== targetBlockId) return tree;
    return {
      type: 'split',
      id: uniqueId('split'),
      direction,
      ratio: 0.5,
      first: tree,
      second: { type: 'leaf', block: newBlock },
    };
  }
  const first = splitLeaf(tree.first, targetBlockId, direction, newBlock);
  const second = splitLeaf(tree.second, targetBlockId, direction, newBlock);
  if (first === tree.first && second === tree.second) return tree;
  return { ...tree, first, second };
}

export function removeBlock(tree: LayoutNode, blockId: string): LayoutNode | null {
  if (tree.type === 'leaf') {
    return tree.block.id === blockId ? null : tree;
  }
  const first = removeBlock(tree.first, blockId);
  const second = removeBlock(tree.second, blockId);
  if (first === null && second === null) return null;
  if (first === null) return second;
  if (second === null) return first;
  if (first === tree.first && second === tree.second) return tree;
  return { ...tree, first, second };
}

export function updateBlock(
  tree: LayoutNode,
  blockId: string,
  updater: (block: Block) => Block,
): LayoutNode {
  if (tree.type === 'leaf') {
    if (tree.block.id !== blockId) return tree;
    const nextBlock = updater(tree.block);
    if (nextBlock === tree.block) return tree;
    return { ...tree, block: nextBlock };
  }
  const first = updateBlock(tree.first, blockId, updater);
  const second = updateBlock(tree.second, blockId, updater);
  if (first === tree.first && second === tree.second) return tree;
  return { ...tree, first, second };
}

export function updateSplitRatio(
  tree: LayoutNode,
  splitId: string,
  ratio: number,
): LayoutNode {
  if (tree.type === 'leaf') return tree;
  if (tree.id === splitId) {
    const clamped = Math.min(Math.max(ratio, 0.1), 0.9);
    if (clamped === tree.ratio) return tree;
    return { ...tree, ratio: clamped };
  }
  const first = updateSplitRatio(tree.first, splitId, ratio);
  const second = updateSplitRatio(tree.second, splitId, ratio);
  if (first === tree.first && second === tree.second) return tree;
  return { ...tree, first, second };
}

export function findBlock(tree: LayoutNode, blockId: string): Block | null {
  if (tree.type === 'leaf') {
    return tree.block.id === blockId ? tree.block : null;
  }
  return findBlock(tree.first, blockId) ?? findBlock(tree.second, blockId);
}

export function forEachBlock(tree: LayoutNode, visit: (block: Block) => void): void {
  if (tree.type === 'leaf') {
    visit(tree.block);
    return;
  }
  forEachBlock(tree.first, visit);
  forEachBlock(tree.second, visit);
}
