'use client';

import type { ReactNode } from 'react';
import { Globe2, PanelBottom, PanelRight, SquareTerminal } from 'lucide-react';

export type PaneTabType = 'terminal' | 'browser';

export interface PaneShellTab {
  id: string;
  label: string;
  type: PaneTabType;
  active?: boolean;
}

export interface PaneActions {
  onAddTerminal?: () => void;
  onAddBrowser?: () => void;
  onSplitRight?: () => void;
  onSplitDown?: () => void;
}

export function PaneShell({
  tabs,
  onSelectTab,
  onCloseTab,
  actions,
  children,
}: {
  tabs: PaneShellTab[];
  onSelectTab: (tabId: string) => void;
  onCloseTab?: (tabId: string) => void;
  actions?: PaneActions;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 min-w-0 items-center overflow-hidden border-b border-stone-800/90 bg-[#202020]">
        {tabs.map((tab) => {
          const Icon = tab.type === 'browser' ? Globe2 : SquareTerminal;
          return (
            <div
              key={tab.id}
              className={[
                'flex h-8 min-w-0 max-w-[220px] items-center border-r border-stone-800 text-[11px]',
                tab.active ? 'bg-[#232323] text-stone-100' : 'text-stone-400',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 truncate px-2 text-left hover:text-stone-100"
                aria-pressed={tab.active}
              >
                <Icon size={11} className="shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
              {tabs.length > 1 && onCloseTab ? (
                <button
                  type="button"
                  onClick={() => onCloseTab(tab.id)}
                  className="shrink-0 px-1.5 text-stone-500 hover:bg-white/10 hover:text-stone-200"
                  aria-label={`Close ${tab.label}`}
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
        {actions ? <PaneActionToolbar actions={actions} /> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function PaneActionToolbar({ actions }: { actions: PaneActions }) {
  return (
    <div className="ml-auto flex h-8 shrink-0 items-center gap-1 px-2 text-stone-500">
      <ActionButton
        onClick={actions.onAddTerminal}
        title="New terminal in this pane"
        ariaLabel="New terminal in this pane"
        icon={<SquareTerminal size={11} />}
      />
      <ActionButton
        onClick={actions.onAddBrowser}
        title="New browser tab (workspace homepage)"
        ariaLabel="New browser tab"
        icon={<Globe2 size={11} />}
      />
      <ActionButton
        onClick={actions.onSplitRight}
        title="Show browser side-panel (right)"
        ariaLabel="Split pane to the right"
        icon={<PanelRight size={11} />}
      />
      <ActionButton
        onClick={actions.onSplitDown}
        title="Show browser side-panel (bottom)"
        ariaLabel="Split pane downward"
        icon={<PanelBottom size={11} />}
      />
    </div>
  );
}

function ActionButton({
  onClick,
  title,
  ariaLabel,
  icon,
}: {
  onClick: (() => void) | undefined;
  title: string;
  ariaLabel: string;
  icon: ReactNode;
}) {
  const disabled = !onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className="flex h-6 w-6 items-center justify-center rounded-sm hover:bg-white/10 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-stone-500"
    >
      {icon}
    </button>
  );
}
