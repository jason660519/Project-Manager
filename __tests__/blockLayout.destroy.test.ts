import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createInitialLayout,
  findBlock,
  forEachBlock,
} from '../components/terminal/blockLayout';

const destroyTerminal = vi.fn();
const destroyBrowser = vi.fn();

vi.mock('../components/terminal/TerminalRegistry', () => ({
  destroy: (...args: unknown[]) => destroyTerminal(...args),
}));

vi.mock('../components/browser/BrowserRegistry', () => ({
  destroy: (...args: unknown[]) => destroyBrowser(...args),
}));

describe('block layout helpers', () => {
  beforeEach(() => {
    destroyTerminal.mockClear();
    destroyBrowser.mockClear();
  });

  it('findBlock locates each leaf in the initial split layout', () => {
    const layout = createInitialLayout('http://localhost:43187/');
    const blockIds: string[] = [];
    forEachBlock(layout, (block) => blockIds.push(block.id));
    expect(blockIds).toHaveLength(1);
    for (const id of blockIds) {
      expect(findBlock(layout, id)?.id).toBe(id);
    }
    expect(findBlock(layout, 'missing')).toBeNull();
  });

  it('destroyBlockItems tears down terminal and browser sessions', async () => {
    const { destroyBlockItems } = await import('../components/terminal/destroyBlockItems');
    const layout = createInitialLayout('http://localhost:43187/');
    const blocks: ReturnType<typeof findBlock>[] = [];
    forEachBlock(layout, (block) => blocks.push(block));

    const block = blocks[0];
    expect(block?.items).toHaveLength(2);

    destroyBlockItems(block!);
    expect(destroyTerminal).toHaveBeenCalledTimes(1);
    expect(destroyBrowser).toHaveBeenCalledTimes(1);
  });
});
