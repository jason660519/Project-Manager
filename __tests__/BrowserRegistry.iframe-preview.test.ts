import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/bridge', () => ({
  xmuxWebviewCreate: vi.fn(),
  xmuxWebviewClearBrowsingData: vi.fn(),
  xmuxWebviewClearConsole: vi.fn(),
  xmuxWebviewClearCookies: vi.fn(),
  xmuxWebviewConsoleEntries: vi.fn(),
  xmuxWebviewCurrentUrl: vi.fn(),
  xmuxWebviewDestroy: vi.fn(),
  xmuxWebviewNavigate: vi.fn(),
  xmuxWebviewEval: vi.fn(),
  xmuxWebviewOpenDevtools: vi.fn(),
  xmuxWebviewCloseDevtools: vi.fn(),
  xmuxWebviewIsDevtoolsOpen: vi.fn(),
  xmuxWebviewReload: vi.fn(),
  xmuxWebviewSelectElement: vi.fn(),
  xmuxWebviewSetBounds: vi.fn(),
  xmuxWebviewSetZoom: vi.fn(),
  xmuxWebviewSetVisible: vi.fn(),
  xmuxWebviewDestroyAll: vi.fn(),
}));

import {
  __resetForTests,
  attach,
  navigate,
} from '../components/browser/BrowserRegistry';

describe('BrowserRegistry iframe preview', () => {
  afterEach(() => {
    __resetForTests();
    document.body.innerHTML = '';
  });

  it('keeps loopback iframe URLs on the current page origin', () => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const current = new URL(window.location.href);
    const port = current.port ? `:${current.port}` : '';
    const target = `http://127.0.0.1${port}/project-progress-dashboard`;

    attach('iframe-preview-origin-test', slot, target);

    const iframe = slot.querySelector('iframe');
    expect(iframe).toBeTruthy();
    const iframeUrl = new URL(iframe!.src);
    expect(iframeUrl.hostname).toBe(current.hostname);
    expect(iframeUrl.pathname).toBe('/project-progress-dashboard');

    navigate('iframe-preview-origin-test', `http://localhost${port}/xmux`);

    const navigatedUrl = new URL(iframe!.src);
    expect(navigatedUrl.hostname).toBe(current.hostname);
    expect(navigatedUrl.pathname).toBe('/xmux');
  });
});
