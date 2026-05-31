import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserContent } from '../components/browser/BrowserContent';
import { BROWSER_CHROME_HEIGHT_PX } from '../components/browser/browser-bounds';
import { __resetForTests as resetBrowserRegistry } from '../components/browser/BrowserRegistry';
import { XMUX_SELECTED_ELEMENT_MIME } from '../lib/xmux/selectedElementSnippet';

const setSlotHidden = vi.fn();
const navigate = vi.fn();
const getNativeCurrentUrl = vi.fn(async (_itemId: string) => 'https://github.com/jason660519/Project-Manager');
const reloadNativeBrowser = vi.fn(async (_itemId: string) => {});
const setNativeBrowserZoom = vi.fn(async (_itemId: string, _scaleFactor: number) => {});
const clearNativeBrowsingData = vi.fn(async (_itemId: string) => {});
const clearNativeConsoleEntries = vi.fn(async (_itemId: string) => {});
const clearNativeCookies = vi.fn(async (_itemId: string) => {});
const evalNativeBrowserScript = vi.fn(async (_itemId: string, _script: string) => {});
const getNativeConsoleEntries = vi.fn(async (_itemId: string) =>
  JSON.stringify([
    {
      id: 'log-1',
      timestamp: '2026-05-27T10:00:00.000Z',
      kind: 'network',
      level: 'error',
      message: 'POST https://collector.github.com/github/collect 503 (Service Unavailable)',
      args: [],
      url: 'https://collector.github.com/github/collect',
      line: null,
      column: null,
      status: 503,
      method: 'POST',
    },
    {
      id: 'log-2',
      timestamp: '2026-05-27T10:00:01.000Z',
      kind: 'console',
      level: 'warn',
      message: 'hydration warning',
      args: ['hydration warning'],
      url: 'https://github.com/jason660519/Project-Manager',
      line: 42,
      column: 7,
      status: null,
      method: null,
    },
  ]),
);
let resolveSelectElement: ((value: string) => void) | null = null;
let rejectSelectElement: ((reason?: unknown) => void) | null = null;

const selectNativeBrowserElement = vi.fn(
  (_itemId: string) =>
    new Promise<string>((resolve, reject) => {
      resolveSelectElement = resolve;
      rejectSelectElement = reject;
    }),
);

const defaultSelectElementPayload = () =>
  JSON.stringify({
    positionTag: 'bottom',
    elementTag: 'button',
    selector: 'body > button',
    cssPath: 'body > button.primary',
    classList: ['primary', 'rounded'],
    computedStyleSummary: {
      display: 'flex',
      position: 'relative',
      zIndex: '10',
      boxSizing: 'border-box',
      fontSize: '14px',
      color: 'rgb(255, 255, 255)',
    },
    computedStyle: {
      display: 'flex',
      position: 'relative',
      color: 'rgb(255, 255, 255)',
      'background-color': 'rgb(31, 111, 235)',
    },
    boxModel: {
      rect: { x: 10, y: 20, width: 120, height: 32 },
      margin: { top: 4, right: 4, bottom: 4, left: 4 },
      border: { top: 1, right: 1, bottom: 1, left: 1 },
      padding: { top: 8, right: 12, bottom: 8, left: 12 },
      content: { width: 94, height: 14 },
    },
    domTree: {
      tag: 'button',
      className: 'primary rounded',
      attributes: { type: 'button' },
      children: [{ tag: 'span', text: 'Sign in', children: [] }],
    },
    outerHTML: '<button class="primary rounded"><span>Sign in</span></button>',
  });

function finishSelectElement(payload = defaultSelectElementPayload()) {
  resolveSelectElement?.(payload);
  resolveSelectElement = null;
  rejectSelectElement = null;
}

function cancelSelectElement() {
  resolveSelectElement?.(JSON.stringify({ cancelled: true }));
  resolveSelectElement = null;
  rejectSelectElement = null;
}

vi.mock('../components/browser/BrowserRegistry', async () => {
  const actual = await vi.importActual<typeof import('../components/browser/BrowserRegistry')>(
    '../components/browser/BrowserRegistry',
  );
  return {
    ...actual,
    backendKind: vi.fn(() => 'tauri'),
    sessionKind: vi.fn(() => 'tauri'),
    cancelBrowserElementSelection: (itemId: string) =>
      evalNativeBrowserScript(itemId, 'window.__pmXmuxSelectElement?.cancel?.();'),
    clearNativeBrowsingData: (itemId: string) => clearNativeBrowsingData(itemId),
    clearNativeConsoleEntries: (itemId: string) => clearNativeConsoleEntries(itemId),
    clearNativeCookies: (itemId: string) => clearNativeCookies(itemId),
    evalNativeBrowserScript: (itemId: string, script: string) => evalNativeBrowserScript(itemId, script),
    getNativeConsoleEntries: (itemId: string) => getNativeConsoleEntries(itemId),
    getNativeCurrentUrl: (itemId: string) => getNativeCurrentUrl(itemId),
    reloadNativeBrowser: (itemId: string) => reloadNativeBrowser(itemId),
    selectBrowserElement: (itemId: string) => selectNativeBrowserElement(itemId),
    selectNativeBrowserElement: (itemId: string) => selectNativeBrowserElement(itemId),
    setNativeBrowserZoom: (itemId: string, scaleFactor: number) => setNativeBrowserZoom(itemId, scaleFactor),
    setSlotHidden: (...args: unknown[]) => setSlotHidden(...args),
    navigate: (...args: unknown[]) => navigate(...args),
  };
});

describe('xmux browser URL chrome', () => {
  afterEach(() => {
    setSlotHidden.mockClear();
    navigate.mockClear();
    getNativeCurrentUrl.mockClear();
    reloadNativeBrowser.mockClear();
    setNativeBrowserZoom.mockClear();
    clearNativeBrowsingData.mockClear();
    clearNativeConsoleEntries.mockClear();
    clearNativeCookies.mockClear();
    evalNativeBrowserScript.mockClear();
    getNativeConsoleEntries.mockClear();
    selectNativeBrowserElement.mockClear();
    resolveSelectElement = null;
    rejectSelectElement = null;
    resetBrowserRegistry();
  });

  function domRect(init: { x: number; y: number; width: number; height: number }): DOMRect {
    return {
      x: init.x,
      y: init.y,
      width: init.width,
      height: init.height,
      top: init.y,
      left: init.x,
      right: init.x + init.width,
      bottom: init.y + init.height,
      toJSON: () => ({}),
    } as DOMRect;
  }

  function setRect(el: Element, rect: DOMRect) {
    Object.defineProperty(el, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });
  }

  function setValidBrowserGeometry() {
    const pane = document.querySelector('[data-browser-pane]');
    const chrome = document.querySelector('[data-browser-chrome]');
    const slot = document.querySelector('[data-browser-slot]');
    expect(pane).toBeTruthy();
    expect(chrome).toBeTruthy();
    expect(slot).toBeTruthy();
    setRect(pane!, domRect({ x: 0, y: 0, width: 900, height: 600 }));
    setRect(
      chrome!,
      domRect({ x: 0, y: 0, width: 900, height: BROWSER_CHROME_HEIGHT_PX }),
    );
    setRect(slot!, domRect({ x: 0, y: BROWSER_CHROME_HEIGHT_PX, width: 900, height: 568 }));
  }

  it('keeps the URL input editable for a GitHub default URL', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <BrowserContent
        itemId="browser-url-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={onNavigate}
      />,
    );
    setValidBrowserGeometry();
    setSlotHidden.mockClear();

    const input = screen.getByLabelText('Browser URL');
    expect(input).toHaveValue('https://github.com/jason660519/Project-Manager');

    await user.click(input);
    expect(screen.getByLabelText('Browser URL')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'example.com/docs');

    expect(screen.getByLabelText('Browser URL')).toHaveValue('example.com/docs');
    expect(setSlotHidden).not.toHaveBeenCalledWith('browser-url-test');

    await user.keyboard('{Enter}');

    expect(onNavigate).toHaveBeenCalledWith('http://example.com/docs');
    expect(screen.getByLabelText('Browser URL')).toHaveValue('http://example.com/docs');
  });

  it('does not hide the active browser content when the URL input receives focus', async () => {
    const user = userEvent.setup();

    render(
      <BrowserContent
        itemId="browser-focus-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={vi.fn()}
      />,
    );
    setValidBrowserGeometry();
    setSlotHidden.mockClear();

    await user.click(screen.getByLabelText('Browser URL'));

    expect(screen.getByLabelText('Browser URL')).toBeInTheDocument();
    expect(setSlotHidden).not.toHaveBeenCalledWith('browser-focus-test');
  });

  it('submits via Enter after editing the URL field', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <BrowserContent
        itemId="browser-go-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={onNavigate}
      />,
    );

    const input = screen.getByLabelText('Browser URL');
    await user.clear(input);
    await user.type(input, 'localhost:43187/xmux');
    await user.keyboard('{Enter}');

    expect(onNavigate).toHaveBeenCalledWith('http://localhost:43187/xmux');
    expect(screen.getByLabelText('Browser URL')).toHaveValue('http://localhost:43187/xmux');
  });

  it('renders Console, CSS Inspector, and DevTools controls without the legacy Go button', () => {
    render(
      <BrowserContent
        itemId="browser-removed-controls-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Go' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Show browser console')).toBeInTheDocument();
    expect(screen.getByLabelText('Show CSS Inspector')).toBeInTheDocument();
    expect(screen.getByLabelText('Open native browser DevTools')).toBeInTheDocument();
  });

  it.each([
    ['google.com', 'http://google.com'],
    ['https://google.com/search?q=xmux', 'https://google.com/search?q=xmux'],
    ['about:blank', 'about:blank'],
  ])('submits common URL draft "%s" as "%s"', async (draft, expected) => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <BrowserContent
        itemId={`browser-submit-${draft}`}
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={onNavigate}
      />,
    );

    const input = screen.getByLabelText('Browser URL');
    await user.clear(input);
    await user.type(input, draft);
    await user.keyboard('{Enter}');

    expect(onNavigate).toHaveBeenCalledWith(expected);
    expect(screen.getByLabelText('Browser URL')).toHaveValue(expected);
  });

  it('keeps an empty draft visible without navigating', () => {
    const onNavigate = vi.fn();

    render(
      <BrowserContent
        itemId="browser-empty-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={onNavigate}
      />,
    );

    const input = screen.getByLabelText('Browser URL');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByLabelText('Browser URL')).toHaveValue('');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('renders browser action menu and copies the current URL', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <BrowserContent
        itemId="browser-actions-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText('Open browser actions menu'));

    expect(screen.getByText('Take Screenshot')).toBeInTheDocument();
    expect(screen.getByText('Capture Area Screenshot')).toBeInTheDocument();
    expect(screen.getByText('Hard Reload')).toBeInTheDocument();
    expect(screen.getByText('Copy Current URL')).toBeInTheDocument();
    expect(screen.getByText('Clear Browsing History')).toBeInTheDocument();
    expect(screen.getByText('Clear Cookies')).toBeInTheDocument();
    expect(screen.getByText('Clear Cache')).toBeInTheDocument();

    await user.click(screen.getByText('Copy Current URL'));

    expect(getNativeCurrentUrl).toHaveBeenCalledWith('browser-actions-test');
    expect(writeText).toHaveBeenCalledWith('https://github.com/jason660519/Project-Manager');
    expect(screen.getByText(/Copied URL:/)).toBeInTheDocument();
  });

  it('wires zoom and native browser maintenance actions', async () => {
    const user = userEvent.setup();

    render(
      <BrowserContent
        itemId="browser-maintenance-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText('Open browser actions menu'));
    await user.click(screen.getByLabelText('Zoom in'));
    expect(setNativeBrowserZoom).toHaveBeenCalledWith('browser-maintenance-test', 1.1);

    await user.click(screen.getByLabelText('Open browser actions menu'));
    await user.click(screen.getByText('Hard Reload'));
    expect(reloadNativeBrowser).toHaveBeenCalledWith('browser-maintenance-test');

    await user.click(screen.getByLabelText('Open browser actions menu'));
    await user.click(screen.getByText('Clear Cookies'));
    expect(clearNativeCookies).toHaveBeenCalledWith('browser-maintenance-test');

    await user.click(screen.getByLabelText('Open browser actions menu'));
    await user.click(screen.getByText('Clear Cache'));
    expect(clearNativeBrowsingData).toHaveBeenCalledWith('browser-maintenance-test');
  });

  it('toggles Select Element mode with an active highlight and dispatches captured context', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const selectedListener = vi.fn();
    window.addEventListener('pm:xmux-selected-element', selectedListener);

    render(
      <div>
        <button type="button">Outside browser pane</button>
        <BrowserContent
          itemId="browser-inspector-test"
          url="https://github.com/jason660519/Project-Manager"
          homepageUrl="https://github.com/jason660519/Project-Manager"
          onNavigate={vi.fn()}
        />
      </div>,
    );

    const selectButton = screen.getByLabelText('Select Element mode');
    await user.click(selectButton);
    await waitFor(() => {
      expect(selectNativeBrowserElement).toHaveBeenCalledWith('browser-inspector-test');
      expect(selectButton).toHaveAttribute('aria-pressed', 'true');
      expect(selectButton.className).toContain('text-blue-200');
      expect(selectButton.className).toContain('ring-blue-400/70');
    });

    await user.click(selectButton);
    await waitFor(() => {
      expect(evalNativeBrowserScript).toHaveBeenCalledWith(
        'browser-inspector-test',
        'window.__pmXmuxSelectElement?.cancel?.();',
      );
      expect(selectButton).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText(/Select Element mode cancelled/)).toBeInTheDocument();
    });
    cancelSelectElement();

    await user.click(selectButton);
    await waitFor(() => expect(selectButton).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(selectButton).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getAllByText(/Select Element mode cancelled/).length).toBeGreaterThan(0);
    });
    cancelSelectElement();

    await user.click(selectButton);
    await waitFor(() => expect(selectButton).toHaveAttribute('aria-pressed', 'true'));

    await user.click(screen.getByRole('button', { name: 'Outside browser pane' }));
    await waitFor(() => {
      expect(selectButton).toHaveAttribute('aria-pressed', 'false');
    });
    cancelSelectElement();

    await user.click(selectButton);
    await waitFor(() => expect(selectButton).toHaveAttribute('aria-pressed', 'true'));
    finishSelectElement();
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"positionTag": "bottom"'));
      expect(selectedListener).toHaveBeenCalled();
      expect(screen.getByText(/Select Element mode remains active/)).toBeInTheDocument();
      expect(selectButton).toHaveAttribute('aria-pressed', 'true');
    });
    const dragContext = screen.getByLabelText('Drag selected element context');
    const dragStore = new Map<string, string>();
    fireEvent.dragStart(dragContext, {
      dataTransfer: {
        effectAllowed: '',
        dropEffect: '',
        setData: (type: string, value: string) => {
          dragStore.set(type, value);
        },
      },
    });
    expect(dragStore.get(XMUX_SELECTED_ELEMENT_MIME)).toContain('[xmux element: bottom · button]');
    expect(dragStore.get('text/plain')).toContain('selector: body > button');
    expect(dragStore.get('application/json')).toContain('"elementTag": "button"');

    await user.click(screen.getByLabelText('Show browser console'));
    expect(screen.getByText('Console')).toBeInTheDocument();
    await waitFor(() => {
      expect(getNativeConsoleEntries).toHaveBeenCalledWith('browser-inspector-test');
      expect(screen.getByText('POST https://collector.github.com/github/collect 503 (Service Unavailable)')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Filter console logs'), 'hydration');
    expect(screen.getByText('hydration warning')).toBeInTheDocument();
    expect(screen.queryByText('POST https://collector.github.com/github/collect 503 (Service Unavailable)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => {
      expect(clearNativeConsoleEntries).toHaveBeenCalledWith('browser-inspector-test');
    });

    await user.click(screen.getByLabelText('Show CSS Inspector'));
    expect(screen.getByText('CSS Inspector')).toBeInTheDocument();
    expect(screen.getByText('button.primary.rounded')).toBeInTheDocument();
    expect(screen.getByText('Box Model')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('W 94')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'CSS' }));
    expect(screen.getByText('primary')).toBeInTheDocument();
    expect(screen.getByText('background-color')).toBeInTheDocument();
    expect(screen.getByText('rgb(31, 111, 235)')).toBeInTheDocument();
    window.removeEventListener('pm:xmux-selected-element', selectedListener);
  });

  it('rejects empty Select Element payloads without dispatching assistant context', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const selectedListener = vi.fn();
    window.addEventListener('pm:xmux-selected-element', selectedListener);

    render(
      <BrowserContent
        itemId="browser-empty-select-payload-test"
        url="https://github.com/jason660519/Project-Manager"
        homepageUrl="https://github.com/jason660519/Project-Manager"
        onNavigate={vi.fn()}
      />,
    );

    const selectButton = screen.getByLabelText('Select Element mode');
    await user.click(selectButton);
    await waitFor(() => expect(selectButton).toHaveAttribute('aria-pressed', 'true'));

    finishSelectElement(JSON.stringify({}));

    await waitFor(() => {
      expect(screen.getByText(/Select Element returned no usable DOM context/)).toBeInTheDocument();
      expect(selectButton).toHaveAttribute('aria-pressed', 'false');
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(selectedListener).not.toHaveBeenCalled();
    window.removeEventListener('pm:xmux-selected-element', selectedListener);
  });

  it('dispatches selected element context before clipboard completion', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(() => new Promise<void>(() => {})) },
    });
    const selectedListener = vi.fn();
    window.addEventListener('pm:xmux-selected-element', selectedListener);

    render(
      <BrowserContent
        itemId="browser-slow-clipboard-select-test"
        url="https://example.com"
        homepageUrl="https://example.com"
        onNavigate={vi.fn()}
      />,
    );

    const selectButton = screen.getByLabelText('Select Element mode');
    await user.click(selectButton);
    await waitFor(() => expect(selectButton).toHaveAttribute('aria-pressed', 'true'));

    finishSelectElement(defaultSelectElementPayload());

    await waitFor(() => {
      expect(selectedListener).toHaveBeenCalled();
      expect(screen.getByText(/Select Element mode remains active/)).toBeInTheDocument();
      expect(screen.getByLabelText('Drag selected element context')).toHaveTextContent('bottom · button');
      expect(selectButton).toHaveAttribute('aria-pressed', 'true');
    });

    window.removeEventListener('pm:xmux-selected-element', selectedListener);
  });

  it('treats blank page selection payloads as cancellation without dispatching assistant context', async () => {
    const user = userEvent.setup();
    const selectedListener = vi.fn();
    window.addEventListener('pm:xmux-selected-element', selectedListener);

    render(
      <BrowserContent
        itemId="browser-blank-select-test"
        url="https://example.com"
        homepageUrl="https://example.com"
        onNavigate={vi.fn()}
      />,
    );

    const selectButton = screen.getByLabelText('Select Element mode');
    await user.click(selectButton);
    await waitFor(() => expect(selectButton).toHaveAttribute('aria-pressed', 'true'));

    finishSelectElement(JSON.stringify({ cancelled: true, reason: 'blank-area' }));

    await waitFor(() => {
      expect(screen.getByText(/Select Element mode cancelled/)).toBeInTheDocument();
      expect(selectButton).toHaveAttribute('aria-pressed', 'false');
    });
    expect(selectedListener).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Drag selected element context')).not.toBeInTheDocument();

    window.removeEventListener('pm:xmux-selected-element', selectedListener);
  });

  it('keeps Select Element state stable across repeated selections', async () => {
    const user = userEvent.setup();
    render(
      <BrowserContent
        itemId="browser-repeat-select-test"
        url="https://example.com"
        homepageUrl="https://example.com"
        onNavigate={vi.fn()}
      />,
    );

    const selectButton = screen.getByLabelText('Select Element mode');
    await user.click(selectButton);
    await waitFor(() => expect(selectButton).toHaveAttribute('aria-pressed', 'true'));
    finishSelectElement(defaultSelectElementPayload());
    await waitFor(() => {
      expect(selectButton).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Drag selected element context')).toHaveTextContent('bottom · button');
    });
    await waitFor(() => expect(selectNativeBrowserElement).toHaveBeenCalledTimes(2));

    await waitFor(() => expect(selectButton).toHaveAttribute('aria-pressed', 'true'));
    finishSelectElement(
      JSON.stringify({
        positionTag: 'top',
        elementTag: 'input',
        selector: 'form > input',
        domTree: { tag: 'input' },
      }),
    );

    await waitFor(() => {
      expect(selectButton).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Drag selected element context')).toHaveTextContent('top · input');
      expect(screen.queryByText('bottom · button')).not.toBeInTheDocument();
    });
    await user.click(selectButton);
    await waitFor(() => expect(selectButton).toHaveAttribute('aria-pressed', 'false'));
  });

  it('keeps captured context visible if automatic Select Element re-arm fails', async () => {
    const user = userEvent.setup();
    render(
      <BrowserContent
        itemId="browser-rearm-failure-test"
        url="https://example.com"
        homepageUrl="https://example.com"
        onNavigate={vi.fn()}
      />,
    );

    const selectButton = screen.getByLabelText('Select Element mode');
    await user.click(selectButton);
    await waitFor(() => expect(selectButton).toHaveAttribute('aria-pressed', 'true'));
    finishSelectElement(defaultSelectElementPayload());
    await waitFor(() => expect(selectNativeBrowserElement).toHaveBeenCalledTimes(2));

    rejectSelectElement?.(new Error('native callback busy'));
    rejectSelectElement = null;

    await waitFor(() => {
      expect(selectButton).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Drag selected element context')).toHaveTextContent('bottom · button');
      expect(screen.getByText(/could not re-arm automatically/)).toBeInTheDocument();
    });
  });
});
