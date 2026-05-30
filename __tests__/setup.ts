import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Minimal next/navigation mock — MainClient calls useRouter() during render,
// but no test cares about navigation. Without this, vitest's plain jsdom
// environment throws "invariant expected app router to be mounted".
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

Element.prototype.scrollIntoView = vi.fn();

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => {
      const ctx: any = {
        fillRect: vi.fn(),
        fillText: vi.fn(),
        clearRect: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
      };
      return ctx;
    }),
    writable: true,
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn(() => 'data:image/png;base64,'),
    writable: true,
  });
}

// xmux layout + xterm need these in jsdom.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// jsdom's Storage implementation can be unreliable — use a clean in-memory mock.
const makeLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
};

const localStorageMock = makeLocalStorage();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});
