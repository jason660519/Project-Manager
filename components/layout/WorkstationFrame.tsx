'use client';

import React from 'react';
import { clsx } from 'clsx';

/**
 * Workstation viewport contract — single source of truth for dashboard-style
 * pages (tables, sheets, tab panels). Enforces the layout rules documented in
 * .claude/skills/dashboard-layout-and-tables/SKILL.md so future views cannot
 * drift out of the contract by accident.
 *
 * Vertical stack (top → bottom):
 *   header   — shrink-0 (title, breadcrumbs)
 *   toolbar  — shrink-0 (filters, search, action buttons)
 *   children — flex-1, min-h-0, owns the only vertical scroll
 *   bottom   — shrink-0 (Excel-style sheet tabs, see BottomSheetTabs)
 *
 * Use `scrollChildren={false}` when the content already manages its own
 * scrolling (e.g. embeds a table with its own overflow-auto), to avoid the
 * double-scrollbar pitfall.
 */
export interface WorkstationFrameProps {
  header?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  bottomTabs?: React.ReactNode;
  /** Wrap children in a min-h-0 flex-1 overflow-auto pane. Default true. */
  scrollChildren?: boolean;
  /** Min height fallback for narrow viewports. Default 560px. */
  minHeightPx?: number;
  /** Reserve px subtracted from 100vh for the outer shell. Default 8rem (128px). */
  reservedRem?: number;
  /** Optional outer className (e.g. mx-auto max-w-7xl). */
  className?: string;
  /** Optional className for the inner panel wrapping toolbar/content/tabs. */
  panelClassName?: string;
}

export function WorkstationFrame({
  header,
  toolbar,
  children,
  bottomTabs,
  scrollChildren = true,
  minHeightPx = 560,
  reservedRem = 8,
  className,
  panelClassName,
}: WorkstationFrameProps) {
  const outerStyle: React.CSSProperties = {
    height: `calc(100vh - ${reservedRem}rem)`,
    minHeight: `${minHeightPx}px`,
  };

  return (
    <div
      style={outerStyle}
      className={clsx('flex min-h-0 flex-col overflow-hidden', className)}
    >
      {header && <div className="flex-none pb-4">{header}</div>}

      <div
        className={clsx(
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          panelClassName,
        )}
      >
        {toolbar && <div className="flex-none">{toolbar}</div>}

        <div
          className={clsx(
            'min-h-0 flex-1',
            scrollChildren ? 'overflow-auto' : 'overflow-hidden',
          )}
        >
          {children}
        </div>

        {bottomTabs && <div className="flex-none">{bottomTabs}</div>}
      </div>
    </div>
  );
}
