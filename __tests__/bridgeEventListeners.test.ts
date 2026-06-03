import { describe, expect, it, vi } from 'vitest';
import { safeUnlisten } from '../lib/bridge';

describe('safeUnlisten', () => {
  it('no-ops when unlisten is undefined', () => {
    expect(() => safeUnlisten(undefined)).not.toThrow();
  });

  it('calls the provided unlisten once', () => {
    const unlisten = vi.fn();
    safeUnlisten(unlisten);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('swallows double-unlisten errors from Tauri event registry', () => {
    const unlisten = vi.fn(() => {
      throw new TypeError("undefined is not an object (evaluating 'listeners[eventId].handlerId')");
    });
    expect(() => safeUnlisten(unlisten)).not.toThrow();
    expect(() => safeUnlisten(unlisten)).not.toThrow();
  });
});
