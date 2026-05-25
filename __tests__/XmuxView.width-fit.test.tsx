import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { XmuxView } from '../app/ui/views/XmuxView';

type ResizeObserverEntry = { target: Element };

describe('XmuxView — responsive width fit + split-down gating', () => {
  let observers: Array<{ callback: (entries: ResizeObserverEntry[]) => void; el: Element | null }> =
    [];

  beforeEach(() => {
    observers = [];
    vi.useFakeTimers();
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      private readonly cb: (entries: ResizeObserverEntry[]) => void;
      private element: Element | null = null;
      constructor(cb: (entries: ResizeObserverEntry[]) => void) {
        this.cb = cb;
        observers.push({ callback: cb, el: null });
      }
      observe(el: Element) {
        this.element = el;
        observers[observers.length - 1]!.el = el;
      }
      unobserve() {}
      disconnect() {}
    };
  });

  function setViewportSize(width: number, height: number) {
    const viewport = document.querySelector('[data-xmux-viewport]') as HTMLDivElement | null;
    expect(viewport).toBeTruthy();
    const el = viewport as HTMLDivElement;
    Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => height });
    for (const ro of observers) {
      if (ro.el === el) {
        act(() => {
          ro.callback([{ target: el }]);
        });
      }
    }
  }

  function blockCount() {
    return screen.getAllByLabelText('Split pane downward').length;
  }

  it('blocks split-right immediately on a narrow viewport (min width constraint)', async () => {
    render(<XmuxView />);
    setViewportSize(800, 500);

    act(() => {
      fireEvent.click(screen.getAllByLabelText('Split pane to the right')[0]!);
    });

    expect(blockCount()).toBe(2);
    expect(screen.getByText(/此視窗尺寸下無法再分割/)).toBeInTheDocument();
  });

  it('allows one split-right on a wider viewport, then blocks when panes become too narrow', async () => {
    render(<XmuxView />);
    setViewportSize(1400, 900);

    act(() => {
      fireEvent.click(screen.getAllByLabelText('Split pane to the right')[0]!);
    });

    expect(blockCount()).toBe(3);

    act(() => {
      fireEvent.click(screen.getAllByLabelText('Split pane to the right')[0]!);
    });

    expect(blockCount()).toBe(3);
    expect(screen.getByText(/此視窗尺寸下無法再分割/)).toBeInTheDocument();
  });

  it('blocks split-down once panes become too short for the current viewport', async () => {
    render(<XmuxView />);
    setViewportSize(800, 500);

    for (let i = 0; i < 8; i += 1) {
      const splitDown = screen.getAllByLabelText('Split pane downward')[0]!;
      act(() => {
        fireEvent.click(splitDown);
      });
    }

    expect(blockCount()).toBe(3);
    expect(screen.getByText(/此視窗尺寸下無法再分割/)).toBeInTheDocument();
  });

  it('allows more split-down depth on a taller viewport before blocking', async () => {
    render(<XmuxView />);
    setViewportSize(1400, 900);

    for (let i = 0; i < 10; i += 1) {
      const splitDown = screen.getAllByLabelText('Split pane downward')[0]!;
      act(() => {
        fireEvent.click(splitDown);
      });
    }

    expect(blockCount()).toBe(4);
    expect(screen.getByText(/此視窗尺寸下無法再分割/)).toBeInTheDocument();
  });
});
