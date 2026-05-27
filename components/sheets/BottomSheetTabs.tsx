'use client';

import React from 'react';
import { clsx } from 'clsx';
import { GripVertical, X } from 'lucide-react';
import {
  moveSheetTab,
  normalizeSheetOrder,
  persistSheetOrder,
  readStoredSheetOrder,
} from './sheetOrder';

/**
 * Excel-style bottom sheet tabs — sits in the bottomTabs slot of
 * WorkstationFrame. Active tab uses an emerald background and a top white
 * indicator line (signalling that this tab's content is shown above, the
 * standard Excel visual metaphor).
 *
 * The generic <Key> lets callers narrow the key union (e.g. 'api_key_validation'
 * | 'llm_arena') so onSelect is type-safe per view.
 */
export interface SheetTabItem<Key extends string> {
  key: Key;
  label: string;
  icon?: React.ReactNode;
  /** Optional trailing count badge (e.g. feature count, error count). */
  badge?: React.ReactNode;
  /** Optional active-state class for views with sheet-specific color coding. */
  activeClassName?: string;
  /** Optional inactive icon color for views with sheet-specific icon coding. */
  iconClassName?: string;
  ariaLabel?: string;
  title?: string;
  closeAriaLabel?: string;
}

export interface BottomSheetTabsProps<Key extends string> {
  tabs: ReadonlyArray<SheetTabItem<Key>>;
  activeKey: Key;
  onSelect: (key: Key) => void;
  className?: string;
  /**
   * Enables pointer-driven tab reordering. The order is a display preference
   * only; callers should keep routing/types/domain state tied to canonical ids.
   */
  reorderable?: boolean;
  /** localStorage key used when reorderable tabs should persist per page. */
  orderStorageKey?: string;
  onOrderChange?: (order: Key[]) => void;
  /** Optional close action for sheet tabs that represent dismissible workspaces. */
  onClose?: (key: Key) => void;
}

export function BottomSheetTabs<Key extends string>({
  tabs,
  activeKey,
  onSelect,
  className,
  reorderable = false,
  orderStorageKey,
  onOrderChange,
  onClose,
}: BottomSheetTabsProps<Key>) {
  const defaultOrderKey = tabs.map((tab) => tab.key).join('\u0000');
  const defaultOrder = React.useMemo(() => tabs.map((tab) => tab.key), [defaultOrderKey]);
  const tabsByKey = React.useMemo(() => new Map(tabs.map((tab) => [tab.key, tab])), [tabs]);
  const [sheetOrder, setSheetOrder] = React.useState<Key[]>(defaultOrder);
  const [draggingKey, setDraggingKey] = React.useState<Key | null>(null);
  const [dropTargetKey, setDropTargetKey] = React.useState<Key | null>(null);
  const [dragPoint, setDragPoint] = React.useState<{ x: number; y: number } | null>(null);
  const sheetOrderRef = React.useRef<Key[]>(defaultOrder);
  const draggingKeyRef = React.useRef<Key | null>(null);
  const dropTargetKeyRef = React.useRef<Key | null>(null);
  const suppressClickRef = React.useRef(false);

  React.useEffect(() => {
    const nextOrder =
      reorderable && orderStorageKey
        ? readStoredSheetOrder(orderStorageKey, defaultOrder)
        : normalizeSheetOrder(sheetOrderRef.current, defaultOrder);
    sheetOrderRef.current = nextOrder;
    setSheetOrder(nextOrder);
  }, [defaultOrderKey, orderStorageKey, reorderable]);

  const orderedTabs = React.useMemo(
    () =>
      (reorderable ? normalizeSheetOrder(sheetOrder, defaultOrder) : defaultOrder)
        .map((key) => tabsByKey.get(key))
        .filter((tab): tab is SheetTabItem<Key> => Boolean(tab)),
    [defaultOrderKey, reorderable, sheetOrder, tabsByKey],
  );

  const commitSheetOrder = React.useCallback(
    (next: ReadonlyArray<Key>) => {
      const normalized = normalizeSheetOrder(next, defaultOrder);
      sheetOrderRef.current = normalized;
      setSheetOrder(normalized);
      if (orderStorageKey) persistSheetOrder(orderStorageKey, normalized);
      onOrderChange?.(normalized);
    },
    [defaultOrderKey, onOrderChange, orderStorageKey],
  );

  const startDrag = React.useCallback(
    (key: Key, button: number, clientX: number, clientY: number) => {
      if (!reorderable || button !== 0) return;
      draggingKeyRef.current = key;
      dropTargetKeyRef.current = null;
      setDraggingKey(key);
      setDropTargetKey(null);
      setDragPoint({ x: clientX, y: clientY });
    },
    [reorderable],
  );

  const enterDragTarget = React.useCallback(
    (key: Key) => {
      if (!reorderable) return;
      const draggedKey = draggingKeyRef.current;
      if (!draggedKey || draggedKey === key || dropTargetKeyRef.current === key) return;
      suppressClickRef.current = true;
      dropTargetKeyRef.current = key;
      setDropTargetKey(key);
      commitSheetOrder(moveSheetTab(sheetOrderRef.current, draggedKey, key));
    },
    [commitSheetOrder, reorderable],
  );

  React.useEffect(() => {
    if (!draggingKey) return;

    const moveDrag = (event: PointerEvent | MouseEvent) => {
      setDragPoint({ x: event.clientX, y: event.clientY });
    };

    const endDrag = () => {
      draggingKeyRef.current = null;
      dropTargetKeyRef.current = null;
      setDraggingKey(null);
      setDropTargetKey(null);
      setDragPoint(null);
    };

    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', endDrag);
    return () => {
      window.removeEventListener('pointermove', moveDrag);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      window.removeEventListener('mousemove', moveDrag);
      window.removeEventListener('mouseup', endDrag);
    };
  }, [draggingKey]);

  const draggingTab = draggingKey ? tabsByKey.get(draggingKey) : null;

  return (
    <>
      <div
        className={clsx(
          'flex flex-none items-end overflow-x-auto border-t border-stone-200/15 bg-[rgb(var(--pm-rail))]/70',
          className,
        )}
      >
        {orderedTabs.map((tab) => {
          const active = tab.key === activeKey;
          const isDragging = draggingKey === tab.key;
          const isDropTarget = dropTargetKey === tab.key && draggingKey !== tab.key;
          const tabClassName = clsx(
            'relative flex transform-gpu select-none items-center gap-2 whitespace-nowrap border-r border-stone-200/15 px-4 py-2.5 text-sm font-medium transition-[background-color,border-color,box-shadow,color,opacity,transform] duration-150 ease-out last:border-r-0 motion-reduce:transform-none motion-reduce:transition-none',
            reorderable && 'cursor-grab active:cursor-grabbing',
            active
              ? tab.activeClassName ?? 'bg-emerald-600/85 text-white shadow-sm'
              : 'text-stone-300/85 hover:bg-white/5 hover:text-stone-100',
            isDragging && 'opacity-40',
            isDropTarget && '-translate-y-0.5 ring-1 ring-inset ring-white/70',
          );
          const tabContents = (
            <>
              {reorderable && (
                <GripVertical className="h-3.5 w-3.5 text-stone-400/80" aria-hidden="true" />
              )}
              {tab.icon && (
                <span className={active ? 'text-current' : tab.iconClassName ?? 'text-amber-100'}>
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={clsx(
                    'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                    active ? 'bg-white/25 text-white' : 'bg-stone-200/15 text-stone-100',
                  )}
                >
                  {tab.badge}
                </span>
              )}
              {active && <span className="absolute left-0 right-0 top-0 h-0.5 bg-white/60" />}
            </>
          );

          if (onClose) {
            return (
              <div
                key={tab.key}
                aria-grabbed={reorderable ? isDragging : undefined}
                title={tab.title ?? (reorderable ? `${tab.label} sheet. Drag to reorder.` : undefined)}
                onPointerDown={(event) => {
                  startDrag(tab.key, event.button, event.clientX, event.clientY);
                }}
                onPointerEnter={() => {
                  enterDragTarget(tab.key);
                }}
                onMouseDown={(event) => {
                  startDrag(tab.key, event.button, event.clientX, event.clientY);
                }}
                onMouseEnter={() => {
                  enterDragTarget(tab.key);
                }}
                className={clsx(tabClassName, 'px-0')}
              >
                <button
                  type="button"
                  aria-label={tab.ariaLabel ?? `${tab.label} sheet`}
                  onClick={(event) => {
                    if (suppressClickRef.current) {
                      event.preventDefault();
                      suppressClickRef.current = false;
                      return;
                    }
                    onSelect(tab.key);
                  }}
                  className="flex min-w-0 items-center gap-2 px-4 py-2.5 text-left"
                >
                  {tabContents}
                </button>
                <button
                  type="button"
                  aria-label={tab.closeAriaLabel ?? `Close ${tab.label} sheet`}
                  title={tab.closeAriaLabel ?? `Close ${tab.label} sheet`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onClose(tab.key);
                  }}
                  className={clsx(
                    'mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm transition-colors',
                    active
                      ? 'text-white/70 hover:bg-white/15 hover:text-white'
                      : 'text-stone-500 hover:bg-white/10 hover:text-stone-100',
                  )}
                >
                  <X size={13} />
                </button>
              </div>
            );
          }

          return (
            <button
              key={tab.key}
              type="button"
              aria-label={tab.ariaLabel ?? `${tab.label} sheet`}
              aria-grabbed={reorderable ? isDragging : undefined}
              title={tab.title ?? (reorderable ? `${tab.label} sheet. Drag to reorder.` : undefined)}
              onClick={(event) => {
                if (suppressClickRef.current) {
                  event.preventDefault();
                  suppressClickRef.current = false;
                  return;
                }
                onSelect(tab.key);
              }}
              onPointerDown={(event) => {
                startDrag(tab.key, event.button, event.clientX, event.clientY);
              }}
              onPointerEnter={() => {
                enterDragTarget(tab.key);
              }}
              onMouseDown={(event) => {
                startDrag(tab.key, event.button, event.clientX, event.clientY);
              }}
              onMouseEnter={() => {
                enterDragTarget(tab.key);
              }}
              className={tabClassName}
            >
              {tabContents}
            </button>
          );
        })}
        <div className="min-w-[20px] flex-1" />
      </div>

      {reorderable && draggingTab && dragPoint && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[9999] flex transform-gpu items-center gap-2 whitespace-nowrap border border-stone-200/25 bg-[rgb(var(--pm-rail))]/95 px-4 py-2.5 text-sm font-medium text-stone-100 opacity-95 shadow-2xl ring-1 ring-white/20 motion-reduce:hidden"
          style={{
            transform: `translate3d(${dragPoint.x + 12}px, ${dragPoint.y - 18}px, 0) rotate(-1deg) scale(1.04)`,
          }}
        >
          <GripVertical className="h-3.5 w-3.5 text-stone-300/90" />
          {draggingTab.icon && (
            <span className={draggingTab.iconClassName ?? 'text-amber-100'}>{draggingTab.icon}</span>
          )}
          <span>{draggingTab.label}</span>
          {draggingTab.badge !== undefined && (
            <span className="ml-1 rounded-full bg-stone-200/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-stone-100">
              {draggingTab.badge}
            </span>
          )}
        </div>
      )}
    </>
  );
}
