'use client';

import { Keyboard, MousePointerClick, Navigation, Play, Search, Settings2 } from 'lucide-react';

interface ShortcutRow {
  keys: string[];
  action: string;
  scope: string;
  status: 'ready' | 'planned';
}

const SHORTCUT_GROUPS: Array<{
  title: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  rows: ShortcutRow[];
}> = [
  {
    title: 'Navigation',
    icon: Navigation,
    rows: [
      { keys: ['G', 'P'], action: 'Open Projects', scope: 'App shell', status: 'planned' },
      { keys: ['G', 'D'], action: 'Open Project Progress Dashboard', scope: 'App shell', status: 'planned' },
      { keys: ['G', 'F'], action: 'Open Project Files', scope: 'App shell', status: 'planned' },
      { keys: ['G', 'L'], action: 'Open Logs', scope: 'App shell', status: 'planned' },
    ],
  },
  {
    title: 'Dispatch',
    icon: Play,
    rows: [
      { keys: ['Cmd', 'K'], action: 'Open Quick Dispatch overlay', scope: 'Global hotkey', status: 'planned' },
      { keys: ['Enter'], action: 'Confirm selected dispatch action', scope: 'Dispatch modal', status: 'planned' },
      { keys: ['Esc'], action: 'Close modal or cancel focused panel', scope: 'Modals', status: 'planned' },
    ],
  },
  {
    title: 'Search and Filters',
    icon: Search,
    rows: [
      { keys: ['/'], action: 'Focus current view search', scope: 'Tables and lists', status: 'planned' },
      { keys: ['Shift', '/'], action: 'Open keyboard shortcuts', scope: 'App shell', status: 'ready' },
    ],
  },
  {
    title: 'Runtime Controls',
    icon: Settings2,
    rows: [
      { keys: ['Cmd', '.'], action: 'Stop selected running process', scope: 'Runs and logs', status: 'planned' },
      { keys: ['R'], action: 'Refresh current project data', scope: 'Project views', status: 'planned' },
    ],
  },
];

function KeyCap({ value }: { value: string }) {
  return (
    <span className="inline-flex min-w-7 items-center justify-center border border-stone-200/20 bg-[rgb(var(--pm-input))] px-2 py-1 font-mono text-[11px] font-medium text-stone-100">
      {value}
    </span>
  );
}

function StatusBadge({ status }: { status: ShortcutRow['status'] }) {
  const isReady = status === 'ready';
  return (
    <span
      className={[
        'inline-flex min-w-[68px] justify-center border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
        isReady
          ? 'border-emerald-300/25 bg-emerald-950/45 text-emerald-200'
          : 'border-amber-200/25 bg-amber-950/35 text-amber-100/80',
      ].join(' ')}
    >
      {isReady ? 'Ready' : 'Planned'}
    </span>
  );
}

export function KeyboardShortcutsView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-amber-200/25 text-amber-100">
            <Keyboard size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-100">
              Keyboard Shortcuts
            </h2>
            <p className="mt-1 text-xs leading-5 text-stone-400">
              Current shortcut map for navigation, dispatch, search, and runtime controls.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-stone-400">
          <MousePointerClick size={14} className="text-stone-500" />
          <span>Press <kbd className="border border-stone-200/20 bg-[rgb(var(--pm-input))] px-1 font-mono text-[10px]">Shift</kbd> + <kbd className="border border-stone-200/20 bg-[rgb(var(--pm-input))] px-1 font-mono text-[10px]">?</kbd> from anywhere to jump here.</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title} className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
            <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
              <group.icon size={15} className="text-stone-300" />
              <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
                {group.title}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))] text-xs uppercase tracking-[0.12em] text-stone-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Keys</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Scope</th>
                    <th className="px-4 py-3 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/10">
                  {group.rows.map((row) => (
                    <tr key={`${group.title}-${row.action}`} className="hover:bg-white/[0.045]">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.keys.map((key, index) => (
                            <span key={`${row.action}-${key}-${index}`} className="flex items-center gap-1.5">
                              {index > 0 && <span className="text-stone-600">+</span>}
                              <KeyCap value={key} />
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-200">{row.action}</td>
                      <td className="px-4 py-3 text-stone-400">{row.scope}</td>
                      <td className="px-4 py-3 text-right">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
