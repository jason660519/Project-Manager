import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { XmuxView } from '../app/ui/views/XmuxView';

let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;

function mockBoundingRect(width: number, height: number) {
  originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };
}

function restoreBoundingRect() {
  if (originalGetBoundingClientRect) {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  }
}

function flushRaf() {
  // jsdom polyfills requestAnimationFrame with setTimeout(_, 0). Use a real microtask flush.
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe('xmux resize overlay & rAF throttle (F28 T-15..T-19)', () => {
  beforeEach(() => {
    mockBoundingRect(1200, 800);
  });

  afterEach(() => {
    restoreBoundingRect();
    vi.restoreAllMocks();
  });

  it('T-15: dragging the primary col divider shows a fixed-position overlay; mouseup removes it', async () => {
    render(<XmuxView />);

    expect(document.querySelector('[data-resize-overlay]')).toBeNull();

    const divider = screen.getByLabelText('Resize terminal browser split');
    fireEvent.mouseDown(divider, { clientX: 600, clientY: 400 });

    const overlay = document.querySelector('[data-resize-overlay]') as HTMLDivElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay!.style.position).toBe('fixed');
    expect(overlay!.style.cursor).toBe('col-resize');
    expect(overlay!.style.zIndex).toBe('50');

    fireEvent.mouseMove(document, { clientX: 700, clientY: 400 });
    await flushRaf();
    fireEvent.mouseUp(document);

    expect(document.querySelector('[data-resize-overlay]')).toBeNull();
  });

  it('T-16: sidebar drag clamps width into [220, 520] and triggers row-resize-free overlay', async () => {
    render(<XmuxView />);

    const sidebarDivider = screen.getByLabelText('Resize workspace sidebar');
    fireEvent.mouseDown(sidebarDivider, { clientX: 300, clientY: 100 });

    const overlay = document.querySelector('[data-resize-overlay]') as HTMLDivElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay!.style.cursor).toBe('col-resize');

    // Beyond the upper clamp.
    fireEvent.mouseMove(document, { clientX: 9999, clientY: 100 });
    await flushRaf();
    fireEvent.mouseUp(document);
    expect(document.querySelector('[data-resize-overlay]')).toBeNull();
  });

  it('T-17: top-bottom drag uses row-resize cursor on the overlay', async () => {
    render(<XmuxView />);

    const divider = screen.getByLabelText('Resize terminal rows');
    fireEvent.mouseDown(divider, { clientX: 600, clientY: 500 });

    const overlay = document.querySelector('[data-resize-overlay]') as HTMLDivElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay!.style.cursor).toBe('row-resize');

    fireEvent.mouseMove(document, { clientX: 600, clientY: 700 });
    await flushRaf();
    fireEvent.mouseUp(document);

    expect(document.querySelector('[data-resize-overlay]')).toBeNull();
  });

  it('T-18: many mousemove events between two rAF frames coalesce to one setter call', async () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    render(<XmuxView />);

    const divider = screen.getByLabelText('Resize terminal browser split');
    fireEvent.mouseDown(divider, { clientX: 600, clientY: 400 });
    const rafCallsAfterMouseDown = rafSpy.mock.calls.length;

    // Burst of 20 synchronous mousemove events before rAF fires.
    for (let i = 0; i < 20; i += 1) {
      fireEvent.mouseMove(document, { clientX: 600 + i, clientY: 400 });
    }

    // Only one rAF was scheduled across the burst (the rest reused the same pending frame).
    expect(rafSpy.mock.calls.length - rafCallsAfterMouseDown).toBe(1);

    await flushRaf();
    fireEvent.mouseUp(document);
    rafSpy.mockRestore();
  });

  it('T-19: notification panel open does not block the resize overlay', async () => {
    const user = userEvent.setup();
    render(<XmuxView />);

    await user.click(screen.getByLabelText('Notification panel'));
    expect(screen.getByText('Notifications')).toBeInTheDocument();

    const divider = screen.getByLabelText('Resize terminal browser split');
    fireEvent.mouseDown(divider, { clientX: 600, clientY: 400 });

    const overlay = document.querySelector('[data-resize-overlay]') as HTMLDivElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay!.style.cursor).toBe('col-resize');

    fireEvent.mouseUp(document);
    expect(document.querySelector('[data-resize-overlay]')).toBeNull();
    // Notification panel still open after drag.
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });
});
