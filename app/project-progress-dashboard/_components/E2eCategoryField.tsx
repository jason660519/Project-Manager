'use client';

import { clsx } from 'clsx';
import {
  DEFAULT_E2E_CATEGORY,
  E2E_CATEGORY_SELECT_OPTIONS,
  e2eCategoryDescription,
  formatE2eCategoryLabel,
  type E2eTestCategoryId,
} from '../_lib/e2eCategories';

interface E2eCategoryFieldProps {
  value: string;
  onChange: (id: E2eTestCategoryId) => void;
}

/** Category picker for Add Row on the E2E testing tab. */
export function E2eCategoryField({ value, onChange }: E2eCategoryFieldProps) {
  const selected = (value || DEFAULT_E2E_CATEGORY) as E2eTestCategoryId;
  const description = e2eCategoryDescription(selected);

  return (
    <div>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value as E2eTestCategoryId)}
        className="input"
        aria-label="E2E category"
      >
        {E2E_CATEGORY_SELECT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {description && (
        <p className="mt-1 text-[10px] leading-snug text-stone-400">{description}</p>
      )}
    </div>
  );
}

interface E2eCategoryBadgeProps {
  categoryId: string;
  className?: string;
}

export function E2eCategoryBadge({ categoryId, className }: E2eCategoryBadgeProps) {
  const description = e2eCategoryDescription(categoryId);
  return (
    <span
      title={description ?? categoryId}
      className={clsx(
        'inline-block max-w-[12rem] truncate rounded-sm border border-cyan-200/25 bg-cyan-100/10 px-2 py-0.5 text-[11px] text-cyan-100/90',
        className,
      )}
    >
      {formatE2eCategoryLabel(categoryId)}
    </span>
  );
}
