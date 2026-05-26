'use client';

/**
 * Shared sheet-order helpers for BottomSheetTabs-style page tabs.
 *
 * Persisted order is intentionally display-only: callers pass canonical tab
 * ids as the default order, and stored preferences are normalized against that
 * canonical set so unknown, duplicate, or newly-added sheets cannot break a UI.
 */
export function normalizeSheetOrder<Key extends string>(
  input: unknown,
  defaultOrder: ReadonlyArray<Key>,
): Key[] {
  if (!Array.isArray(input)) return [...defaultOrder];

  const knownIds = new Set<string>(defaultOrder);
  const seen = new Set<Key>();
  const ordered: Key[] = [];

  for (const item of input) {
    if (typeof item !== 'string' || !knownIds.has(item) || seen.has(item as Key)) {
      continue;
    }
    const key = item as Key;
    seen.add(key);
    ordered.push(key);
  }

  return [...ordered, ...defaultOrder.filter((key) => !seen.has(key))];
}

export function moveSheetTab<Key extends string>(
  order: ReadonlyArray<Key>,
  from: Key,
  to: Key,
): Key[] {
  if (from === to) return [...order];
  const fromIndex = order.indexOf(from);
  const toIndex = order.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return [...order];

  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, from);
  return next;
}

export function readStoredSheetOrder<Key extends string>(
  storageKey: string,
  defaultOrder: ReadonlyArray<Key>,
): Key[] {
  if (typeof window === 'undefined') return [...defaultOrder];
  try {
    return normalizeSheetOrder(JSON.parse(window.localStorage.getItem(storageKey) ?? 'null'), defaultOrder);
  } catch {
    return [...defaultOrder];
  }
}

export function persistSheetOrder<Key extends string>(storageKey: string, order: ReadonlyArray<Key>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(order));
}
