import { destroy as destroyBrowser } from '../browser/BrowserRegistry';
import { destroy as destroyTerminal } from './TerminalRegistry';
import type { Block, BlockItem } from './blockLayout';

export function destroyBlockItem(item: BlockItem): void {
  if (item.kind === 'terminal') {
    destroyTerminal(item.id);
  } else if (item.kind === 'browser') {
    destroyBrowser(item.id);
  }
}

export function destroyBlockItems(block: Block): void {
  for (const item of block.items) {
    destroyBlockItem(item);
  }
}
