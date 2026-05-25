import { describe, expect, it } from 'vitest';
import {
  checkLayoutFits,
  collectLeafSizeFractions,
  countBlocks,
  createBlock,
  splitLeaf,
  type LayoutNode,
} from '../components/terminal/blockLayout';

describe('xmux block layout fit checks', () => {
  it('collectLeafSizeFractions returns one entry per leaf', () => {
    const leftMostLeafId = (node: LayoutNode): string => {
      if (node.type === 'leaf') return node.block.id;
      return leftMostLeafId(node.first);
    };

    let layout: LayoutNode = { type: 'leaf', block: createBlock() };
    layout = splitLeaf(layout, layout.block.id, 'vertical', createBlock());
    layout = splitLeaf(layout, leftMostLeafId(layout), 'horizontal', createBlock());

    expect(countBlocks(layout)).toBe(3);
    const leaves = collectLeafSizeFractions(layout);
    expect(leaves).toHaveLength(3);
    for (const leaf of leaves) {
      expect(leaf.widthFraction).toBeGreaterThan(0);
      expect(leaf.heightFraction).toBeGreaterThan(0);
    }
  });

  it('checkLayoutFits fails when any leaf would be smaller than min dimensions', () => {
    const blockA = createBlock();
    const blockB = createBlock();
    const tiny: LayoutNode = {
      type: 'split',
      id: 'split-test',
      direction: 'vertical',
      ratio: 0.1,
      first: { type: 'leaf', block: blockA },
      second: { type: 'leaf', block: blockB },
    };

    const fit = checkLayoutFits(tiny, 1000, 800, 300, 200);
    expect(fit.ok).toBe(false);
    expect(fit.failingBlockId).toBe(blockA.id);
  });

  it('checkLayoutFits passes for common splits in a large viewport', () => {
    let layout: LayoutNode = { type: 'leaf', block: createBlock() };
    const rootId = layout.block.id;
    layout = splitLeaf(layout, rootId, 'vertical', createBlock());
    layout = splitLeaf(layout, rootId, 'horizontal', createBlock());
    layout = splitLeaf(layout, rootId, 'vertical', createBlock());

    const fit = checkLayoutFits(layout, 1600, 900, 300, 200);
    expect(fit.ok).toBe(true);
  });
});
