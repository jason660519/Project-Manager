import { describe, expect, it } from 'vitest';
import {
  appendXmuxSnippetToInput,
  formatXmuxSelectedElementSnippet,
  isXmuxSelectedElementPayload,
} from '../lib/xmux/selectedElementSnippet';

describe('xmux selected element snippet', () => {
  it('formats a compact snippet with selector and summary JSON', () => {
    const snippet = formatXmuxSelectedElementSnippet({
      positionTag: 'bottom',
      elementTag: 'button',
      selector: 'body > button',
      url: 'https://example.com',
      domTree: { tag: 'button' },
      outerHTML: '<button>Go</button>',
    });

    expect(snippet).toContain('[xmux element: bottom · button]');
    expect(snippet).toContain('selector: body > button');
    expect(snippet).toContain('"domTree"');
    expect(snippet).toContain('<button>Go</button>');
  });

  it('appends after existing input text', () => {
    const next = appendXmuxSnippetToInput('hello world', '[xmux element: top · div]');
    expect(next.startsWith('hello world')).toBe(true);
    expect(next.endsWith('[xmux element: top · div]')).toBe(true);
    expect(next).toBe('hello world\n\n[xmux element: top · div]');
  });

  it('uses the snippet alone when input is empty', () => {
    const snippet = '[xmux element: bottom · button]';
    expect(appendXmuxSnippetToInput('', snippet)).toBe(snippet);
  });

  it('rejects empty and cancelled selected element payloads', () => {
    expect(isXmuxSelectedElementPayload({})).toBe(false);
    expect(isXmuxSelectedElementPayload({ cancelled: true })).toBe(false);
    expect(isXmuxSelectedElementPayload(null)).toBe(false);
  });

  it('accepts DOM-rich payloads and derives the element tag from nested element data', () => {
    const payload = {
      positionTag: 'middle',
      selector: 'main > a',
      element: { tag: 'a', text: 'Read more' },
      ancestry: [{ tag: 'main' }],
    };

    expect(isXmuxSelectedElementPayload(payload)).toBe(true);
    const snippet = formatXmuxSelectedElementSnippet(payload);
    expect(snippet).toContain('[xmux element: middle · a]');
    expect(snippet).toContain('"element"');
    expect(snippet).toContain('"ancestry"');
  });
});
