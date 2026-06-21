'use client';

import { useRef, type MutableRefObject } from 'react';

/**
 * Returns a ref that always holds the latest value (updated every render).
 *
 * Use it in TanStack tables to read volatile per-row state + event handlers from
 * INSIDE cell renderers WITHOUT listing them in the `columns` useMemo deps.
 *
 * Why this matters: TanStack `flexRender` renders a cell via
 * `React.createElement(cellFn, …)`, so the cell function *is* the component type.
 * If `columns` is rebuilt (because its deps include handlers/state that change on
 * every parent render), each cell gets a new function identity → React sees a new
 * component type → it REMOUNTS the cell's `<input>`/`<textarea>`, dropping focus
 * after a single keystroke. Reading volatile values through this ref lets the
 * `columns` memo stay referentially stable, so editable cells keep focus.
 *
 * See docs/engineering/table-standards.md (PM hub) and useLiveRef usage in
 * components/table/datasheet/.
 */
export function useLiveRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
