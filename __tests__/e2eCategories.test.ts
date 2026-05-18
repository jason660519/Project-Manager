import { describe, expect, it } from 'vitest';
import {
  DEFAULT_E2E_CATEGORY,
  E2E_TEST_CATEGORY_IDS,
  e2eCategorySearchTokens,
  formatE2eCategoryLabel,
  formatE2eCategoryShort,
  isKnownE2eCategory,
  sortE2eCategoryIds,
} from '../app/project-progress-dashboard/_lib/e2eCategories';

describe('e2eCategories', () => {
  it('defines eight canonical categories', () => {
    expect(E2E_TEST_CATEGORY_IDS).toHaveLength(8);
    expect(DEFAULT_E2E_CATEGORY).toBe('in_project');
  });

  it('formats bilingual labels', () => {
    expect(formatE2eCategoryLabel('acceptance')).toContain('驗收');
    expect(formatE2eCategoryLabel('acceptance')).toContain('Acceptance');
    expect(formatE2eCategoryShort('cross_project')).toBe('跨專案 E2E');
  });

  it('recognises known ids and sorts in canonical order', () => {
    expect(isKnownE2eCategory('smoke')).toBe(true);
    expect(isKnownE2eCategory('Custom')).toBe(false);
    expect(sortE2eCategoryIds(['regression', 'smoke', 'legacy'])).toEqual([
      'smoke',
      'regression',
      'legacy',
    ]);
  });

  it('exposes search tokens for toolbar filtering', () => {
    const tokens = e2eCategorySearchTokens('migration');
    expect(tokens).toContain('migration');
    expect(tokens).toContain('升級');
  });
});
