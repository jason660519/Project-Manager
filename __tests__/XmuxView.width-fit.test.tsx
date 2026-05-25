import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { XmuxView } from '../app/ui/views/XmuxView';

type ResizeObserverEntry = { target: Element };

describe('XmuxView — responsive width fit + split-down gating', () => {
  let observers: Array<{
    callback: (entries: ResizeObserverEntry[]) => void;
    el: Element | null;
  }> = [];

  beforeEach(() => {
    observers = [];
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      private readonly cb: (entries: ResizeObserverEntry[]) => void;
      private readonly observerIndex: number;
      constructor(cb: (entries: ResizeObserverEntry[]) => void) {
        this.cb = cb;
        this.observerIndex = observers.length;
        observers.push({ callback: cb, el: null });
      }
      observe(el: Element) {
        observers[this.observerIndex]!.el = el;
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

  it('allows one split-right on a narrow viewport, then blocks panes below the min width', async () => {
    render(<XmuxView />);
    await act(async () => {});
    setViewportSize(800, 500);

    act(() => {
      fireEvent.click(screen.getAllByLabelText('Split pane to the right')[0]!);
    });

    expect(blockCount()).toBe(2);

    act(() => {
      fireEvent.click(screen.getAllByLabelText('Split pane to the right')[0]!);
    });

    expect(blockCount()).toBe(2);
    expect(screen.getByText(/此視窗尺寸下無法再分割/)).toBeInTheDocument();
  });

  it('allows more split-right width on a wider viewport, then blocks when panes become too narrow', async () => {
    render(<XmuxView />);
    await act(async () => {});
    setViewportSize(1400, 900);

    act(() => {
      fireEvent.click(screen.getAllByLabelText('Split pane to the right')[0]!);
    });

    expect(blockCount()).toBe(2);

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
    await act(async () => {});
    setViewportSize(800, 500);

    for (let i = 0; i < 8; i += 1) {
      const splitDown = screen.getAllByLabelText('Split pane downward')[0]!;
      act(() => {
        fireEvent.click(splitDown);
      });
    }

    expect(blockCount()).toBe(2);
    expect(screen.getByText(/此視窗尺寸下無法再分割/)).toBeInTheDocument();
  });

  it('allows more split-down depth on a taller viewport before blocking', async () => {
    render(<XmuxView />);
    await act(async () => {});
    setViewportSize(1400, 900);

    for (let i = 0; i < 10; i += 1) {
      const splitDown = screen.getAllByLabelText('Split pane downward')[0]!;
      act(() => {
        fireEvent.click(splitDown);
      });
    }

    expect(blockCount()).toBe(3);
    expect(screen.getByText(/此視窗尺寸下無法再分割/)).toBeInTheDocument();
  });
});
