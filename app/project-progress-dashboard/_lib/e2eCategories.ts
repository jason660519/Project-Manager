/**
 * Canonical E2E test categories for the project-progress dashboard.
 * Stored as `feature.category` / custom-row `category` when `phase === 'e2e_testing'`.
 */

export const E2E_TEST_CATEGORIES = [
  {
    id: 'in_project',
    zhLabel: '專案內跨 features',
    enLabel: 'In-project cross-feature',
    description: 'Flows spanning multiple modules or features within one product/repo.',
  },
  {
    id: 'cross_project',
    zhLabel: '跨專案 E2E',
    enLabel: 'Cross-project E2E',
    description: 'Integration across multiple projects, services, or deployable units.',
  },
  {
    id: 'external',
    zhLabel: '第三方整合',
    enLabel: 'External integration',
    description: 'OAuth, payments, email, OS APIs, Tauri bridge, or other third-party boundaries.',
  },
  {
    id: 'smoke',
    zhLabel: '冒煙／黃金路徑',
    enLabel: 'Smoke & golden path',
    description: 'Minimal post-deploy checks on critical user journeys (fast, few scenarios).',
  },
  {
    id: 'regression',
    zhLabel: '回歸',
    enLabel: 'Regression',
    description: 'Broader suite before release to catch regressions in existing behaviour.',
  },
  {
    id: 'acceptance',
    zhLabel: '驗收',
    enLabel: 'Acceptance / UAT',
    description: 'Scenario-based acceptance tied to requirements (Given-When-Then / UAT).',
  },
  {
    id: 'migration',
    zhLabel: '升級遷移',
    enLabel: 'Migration & upgrade',
    description: 'Schema upgrades, config migration, app updates, and backward compatibility.',
  },
  {
    id: 'monitoring',
    zhLabel: '生產合成監控',
    enLabel: 'Synthetic monitoring',
    description: 'Scheduled smoke in production/staging for SLOs and alerting.',
  },
] as const;

export type E2eTestCategoryId = (typeof E2E_TEST_CATEGORIES)[number]['id'];

export const E2E_TEST_CATEGORY_IDS: E2eTestCategoryId[] = E2E_TEST_CATEGORIES.map((c) => c.id);

export const DEFAULT_E2E_CATEGORY: E2eTestCategoryId = 'in_project';

const BY_ID = new Map(E2E_TEST_CATEGORIES.map((c) => [c.id, c]));

export function isKnownE2eCategory(value: string): value is E2eTestCategoryId {
  return BY_ID.has(value as E2eTestCategoryId);
}

export function getE2eCategoryMeta(id: string) {
  return isKnownE2eCategory(id) ? BY_ID.get(id) : undefined;
}

/** Bilingual chip label: `專案內跨 features · In-project cross-feature` */
export function formatE2eCategoryLabel(id: string): string {
  const meta = getE2eCategoryMeta(id);
  if (!meta) return id;
  return `${meta.zhLabel} · ${meta.enLabel}`;
}

/** Short toolbar label: Chinese primary with English in title attribute context. */
export function formatE2eCategoryShort(id: string): string {
  const meta = getE2eCategoryMeta(id);
  return meta ? meta.zhLabel : id;
}

export function e2eCategoryDescription(id: string): string | undefined {
  return getE2eCategoryMeta(id)?.description;
}

/** Extra search tokens (ids + zh + en) for toolbar search on the E2E tab. */
export function e2eCategorySearchTokens(id: string): string {
  const meta = getE2eCategoryMeta(id);
  if (!meta) return id;
  return `${meta.id} ${meta.zhLabel} ${meta.enLabel}`.toLowerCase();
}

export const E2E_CATEGORY_SELECT_OPTIONS: Array<{ value: E2eTestCategoryId; label: string }> =
  E2E_TEST_CATEGORIES.map((c) => ({
    value: c.id,
    label: formatE2eCategoryLabel(c.id),
  }));

/** Per-category select/badge colours on the E2E tab. */
export const E2E_CATEGORY_PALETTE: Record<E2eTestCategoryId, string> = {
  in_project:    'border-cyan-300/40 text-cyan-100',
  cross_project: 'border-violet-300/40 text-violet-100',
  external:      'border-orange-300/40 text-orange-100',
  smoke:         'border-emerald-300/40 text-emerald-100',
  regression:    'border-amber-300/40 text-amber-100',
  acceptance:    'border-sky-300/40 text-sky-100',
  migration:     'border-fuchsia-300/40 text-fuchsia-100',
  monitoring:    'border-stone-300/40 text-stone-200',
};

export function e2eCategorySelectOptions(current?: string): Array<{ value: string; label: string }> {
  const base = E2E_CATEGORY_SELECT_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
  if (current && !isKnownE2eCategory(current)) {
    return [{ value: current, label: `${current} (legacy)` }, ...base];
  }
  return base;
}

export function sortE2eCategoryIds(ids: string[]): string[] {
  const order = new Map(E2E_TEST_CATEGORY_IDS.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => {
    const ai = order.get(a as E2eTestCategoryId) ?? 999;
    const bi = order.get(b as E2eTestCategoryId) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}
