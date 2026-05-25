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

export function createFolderItem(path: string, label?: string): FolderItem {
  return {
    kind: 'folder',
    id: uniqueId('folder'),
    label: label ?? deriveFolderLabel(path),
    path,
  };
}

export function createBlock(seed?: BlockItem): Block {
  const item = seed ?? createTerminalItem();
  return { id: uniqueId('block'), items: [item], activeItemId: item.id };
}

// First-time layout for a workspace: terminal (left) + browser (right) so both
// surfaces are visible without hunting through tabs.
export function createInitialLayout(homepageUrl: string): LayoutNode {
  return {
    type: 'split',
    id: uniqueId('split'),
    direction: 'vertical',
    ratio: 0.5,
    first: { type: 'leaf', block: createBlock(createTerminalItem()) },
    second: { type: 'leaf', block: createBlock(createBrowserItem(homepageUrl)) },
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

export function countBlocks(tree: LayoutNode): number {
  if (tree.type === 'leaf') return 1;
  return countBlocks(tree.first) + countBlocks(tree.second);
}

export type LeafSizeFraction = {
  blockId: string;
  widthFraction: number;
  heightFraction: number;
};

export function collectLeafSizeFractions(
  tree: LayoutNode,
  widthFraction: number = 1,
  heightFraction: number = 1,
): LeafSizeFraction[] {
  if (tree.type === 'leaf') {
    return [{ blockId: tree.block.id, widthFraction, heightFraction }];
  }
  if (tree.direction === 'vertical') {
    return [
      ...collectLeafSizeFractions(tree.first, widthFraction * tree.ratio, heightFraction),
      ...collectLeafSizeFractions(tree.second, widthFraction * (1 - tree.ratio), heightFraction),
    ];
  }
  return [
    ...collectLeafSizeFractions(tree.first, widthFraction, heightFraction * tree.ratio),
    ...collectLeafSizeFractions(tree.second, widthFraction, heightFraction * (1 - tree.ratio)),
  ];
}

export type LayoutFitCheck = {
  ok: boolean;
  failingBlockId?: string;
  minBlockWidthPx: number;
  minBlockHeightPx: number;
};

export function checkLayoutFits(
  tree: LayoutNode,
  containerWidth: number,
  containerHeight: number,
  minBlockWidthPx: number,
  minBlockHeightPx: number,
): LayoutFitCheck {
  const leaves = collectLeafSizeFractions(tree);
  let minWidth = Number.POSITIVE_INFINITY;
  let minHeight = Number.POSITIVE_INFINITY;
  for (const leaf of leaves) {
    const w = containerWidth * leaf.widthFraction;
    const h = containerHeight * leaf.heightFraction;
    if (w < minWidth) minWidth = w;
    if (h < minHeight) minHeight = h;
    if (w < minBlockWidthPx || h < minBlockHeightPx) {
      return {
        ok: false,
        failingBlockId: leaf.blockId,
        minBlockWidthPx: minWidth === Number.POSITIVE_INFINITY ? 0 : minWidth,
        minBlockHeightPx: minHeight === Number.POSITIVE_INFINITY ? 0 : minHeight,
      };
    }
  }
  return {
    ok: true,
    minBlockWidthPx: minWidth === Number.POSITIVE_INFINITY ? 0 : minWidth,
    minBlockHeightPx: minHeight === Number.POSITIVE_INFINITY ? 0 : minHeight,
  };
}
