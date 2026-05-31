import { describe, expect, it } from 'vitest';
import {
  appendXmuxSnippetToInput,
  formatXmuxSelectedElementSnippet,
  isXmuxSelectedElementPayload,
  setXmuxSnippetDragData,
  XMUX_SELECTED_ELEMENT_MIME,
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

  it('treats whitespace-only input as blank before inserting the snippet', () => {
    const snippet = '[xmux element: bottom · button]';
    expect(appendXmuxSnippetToInput('  \n\t', snippet)).toBe(snippet);
  });

  it('appends after unsubmitted multiline input without inserting into the middle', () => {
    const snippet = '[xmux element: bottom · button]';
    expect(appendXmuxSnippetToInput('line 1\nline 2\n', snippet)).toBe(
      'line 1\nline 2\n[xmux element: bottom · button]',
    );
  });

  it('sets plain text, html, custom mime, and JSON data for drag targets', () => {
    const store = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: '',
      setData: (type: string, value: string) => {
        store.set(type, value);
      },
    } as unknown as DataTransfer;
    const snippet = '[xmux element: bottom · button]\n<button>Go</button>';

    setXmuxSnippetDragData(dataTransfer, snippet, { elementTag: 'button' });

    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(store.get(XMUX_SELECTED_ELEMENT_MIME)).toBe(snippet);
    expect(store.get('text/plain')).toBe(snippet);
    expect(store.get('text/html')).toContain('&lt;button&gt;Go&lt;/button&gt;');
    expect(store.get('application/json')).toContain('"elementTag": "button"');
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

  it('bounds large DOM payloads before inserting them into chat input', () => {
    const payload = {
      positionTag: 'center',
      elementTag: 'section',
      selector: 'main > section',
      outerHTML: `<section>${'x'.repeat(3000)}</section>`,
      domTree: {
        tag: 'section',
        children: Array.from({ length: 40 }, (_, index) => ({
          tag: 'div',
          text: `row ${index}`,
          children: [{ tag: 'span', text: 'deep child' }],
        })),
      },
    };

    const snippet = formatXmuxSelectedElementSnippet(payload);

    expect(snippet).toContain('[xmux element: center · section]');
    expect(snippet).toContain('truncated');
    expect(snippet.length).toBeLessThan(9000);
  });
});
