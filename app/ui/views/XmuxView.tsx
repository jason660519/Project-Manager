'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Bell,
  Chrome,
  ExternalLink,
  Folder,
  Globe2,
  PanelBottom,
  PanelRight,
  PanelsTopLeft,
  SquareTerminal,
} from 'lucide-react';
import { TerminalPaneGroup } from '../../../components/terminal/TerminalPaneGroup';
import type { ProjectEntry } from '../../../lib/types';

interface WorkspaceRow {
  id: string;
  name: string;
  branch: string;
  cwd: string;
  notification?: string;
}

interface PaneTab {
  label: string;
  active?: boolean;
  icon: 'terminal' | 'browser';
}

interface XmuxViewProps {
  projects?: ProjectEntry[];
  selectedDashboardProjectIds?: string[];
  selectedProjectId?: string;
}

type SplitLayout = 'vertical' | 'horizontal';
type WorkspaceScope = 'dashboard' | 'all';

const fallbackWorkspaces: WorkspaceRow[] = [
  {
    id: 'project-manager',
    name: 'Project Management',
    branch: 'dispatch-wip-20260525*',
    cwd: '/Volumes/KLEVV-4T-1/Project-Manager',
    notification: 'xmux review requested',
  },
  {
    id: 'realestate-management-apps',
    name: 'Realestate_Management_Apps',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/Realestate_Management_Apps',
    notification: 'Codex waiting for input',
  },
  {
    id: 'comfy-ui',
    name: 'ComfyUI',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/Real Estate Management',
  },
  {
    id: 'saydo',
    name: 'SayDo',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/SayDo',
  },
  {
    id: 'company-ai-app-standards',
    name: 'Company-AI-App-Standards',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/Company-AI-App-Standards',
  },
];

function deriveWorkspaceRows(
  projects: ProjectEntry[] | undefined,
  selectedDashboardProjectIds: string[] | undefined,
  selectedProjectId: string | undefined,
  scope: WorkspaceScope,
): WorkspaceRow[] {
  if (!projects || projects.length === 0) {
    return fallbackWorkspaces;
  }

  const byId = new Map(projects.map((project) => [project.id, project]));
  const dashboardProjects = (selectedDashboardProjectIds ?? [])
    .map((id) => byId.get(id))
    .filter((project): project is ProjectEntry => Boolean(project));
  const source = scope === 'dashboard' ? dashboardProjects : projects;

  if (source.length === 0) {
    return [];
  }

  return source.map((project) => {
    const hasUnread =
      project.id !== selectedProjectId &&
      project.config.features.some((feature) => feature.status === 'in_progress');
    return {
      id: project.id,
      name: project.config.project.name || project.id,
      branch: project.config.project.githubUrl ? 'github' : 'local*',
      cwd: project.config.project.root || project.configPath,
      notification: hasUnread ? 'Feature in progress' : undefined,
    };
  });
}

function WorkspaceSidebar({
  notificationOpen,
  hasPendingAlerts,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onToggleNotifications,
}: {
  notificationOpen: boolean;
  hasPendingAlerts: boolean;
  workspaces: WorkspaceRow[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onToggleNotifications: () => void;
}) {
  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col border-r border-stone-700/80 bg-[#1f2326] text-stone-200">
      <div className="flex h-9 items-center justify-between border-b border-stone-700/70 px-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-stone-400 uppercase">Workspaces</span>
        <button
          type="button"
          onClick={onToggleNotifications}
          className={[
            'relative flex h-6 w-6 items-center justify-center rounded-sm transition-colors hover:bg-white/8 hover:text-stone-100',
            notificationOpen ? 'bg-blue-400/15 text-blue-200 ring-1 ring-blue-300/30' : 'text-stone-400',
            hasPendingAlerts && !notificationOpen ? 'animate-pulse text-blue-300' : '',
          ].join(' ')}
          aria-label="Notification panel"
          aria-pressed={notificationOpen}
          title="Notification panel (Cmd+I)"
        >
          <Bell size={13} />
          {hasPendingAlerts ? (
            <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-blue-300" />
          ) : null}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {workspaces.map((workspace) => (
          <button
            type="button"
            key={workspace.id}
            onClick={() => onSelectWorkspace(workspace.id)}
            className={[
              'mb-1 block w-full rounded-md px-2.5 py-2 text-left transition-colors',
              workspace.id === activeWorkspaceId
                ? 'bg-blue-500 text-white shadow-[0_0_0_1px_rgba(147,197,253,0.7)]'
                : 'text-stone-300 hover:bg-white/6 hover:text-stone-100',
            ].join(' ')}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="block truncate text-[13px] font-semibold">{workspace.name}</span>
              {workspace.notification ? (
                <span
                  className={[
                    'ml-auto h-2 w-2 shrink-0 rounded-full',
                    notificationOpen ? 'bg-blue-200 shadow-[0_0_0_3px_rgba(96,165,250,0.3)]' : 'bg-blue-400',
                  ].join(' ')}
                  aria-label={`${workspace.name} has unread notification`}
                />
              ) : null}
            </span>
            <span
              className={`mt-1 block truncate font-mono text-[11px] ${
                workspace.id === activeWorkspaceId ? 'text-blue-100' : 'text-stone-400'
              }`}
            >
              {workspace.branch} {workspace.cwd}
            </span>
            {workspace.notification ? (
              <span
                className={`mt-1 block truncate text-[11px] ${
                  workspace.id === activeWorkspaceId ? 'text-blue-50' : 'text-stone-500'
                }`}
              >
                {workspace.notification}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </aside>
  );
}

function PaneTabs({ tabs }: { tabs: PaneTab[] }) {
  return (
    <div className="flex min-w-0 items-center overflow-hidden border-b border-stone-800/90 bg-[#202020]">
      {tabs.map((tab, index) => {
        const Icon = tab.icon === 'browser' ? Globe2 : SquareTerminal;
        return (
          <div
            key={`${tab.label}-${index}`}
            className={[
              'flex h-8 min-w-0 items-center gap-1.5 border-r border-stone-800 px-2 text-[11px]',
              tab.active ? 'bg-[#232323] text-stone-100' : 'text-stone-400',
            ].join(' ')}
          >
            <Icon size={11} className="shrink-0" />
            <span className="truncate">{tab.label}</span>
          </div>
        );
      })}
      <div className="ml-auto flex items-center gap-2 px-2 text-stone-500">
        <SquareTerminal size={11} />
        <Globe2 size={11} />
        <PanelBottom size={11} />
        <PanelRight size={11} />
      </div>
    </div>
  );
}

function BrowserPane() {
  const [urlInput, setUrlInput] = useState('http://localhost:43187/project-progress-dashboard');
  const [browserUrl, setBrowserUrl] = useState('http://localhost:43187/project-progress-dashboard');

  const navigate = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const nextUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    setUrlInput(nextUrl);
    setBrowserUrl(nextUrl);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1e1e1e]">
      <div className="flex h-8 items-center gap-2 border-b border-stone-800 px-2 text-[11px] text-stone-400">
        <Chrome size={13} className="shrink-0 text-stone-300" />
        <input
          value={urlInput}
          onChange={(event) => setUrlInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') navigate();
          }}
          className="min-w-0 flex-1 bg-[#151515] px-2 py-1 text-stone-200 outline-none ring-1 ring-stone-800 focus:ring-sky-400/50"
          aria-label="Browser URL"
        />
        <button
          type="button"
          onClick={navigate}
          className="shrink-0 border border-stone-700 px-2 py-1 text-stone-300 hover:border-stone-500 hover:text-stone-100"
        >
          Go
        </button>
        <a
          href={browserUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-6 w-6 shrink-0 items-center justify-center border border-stone-700 text-stone-300 hover:border-stone-500 hover:text-stone-100"
          aria-label="Open browser URL externally"
        >
          <ExternalLink size={12} />
        </a>
      </div>
      <iframe
        key={browserUrl}
        src={browserUrl}
        title="xmux browser pane"
        className="min-h-0 flex-1 border-0 bg-white"
      />
    </div>
  );
}

function NotificationPanel({ onClose, workspaceName }: { onClose: () => void; workspaceName: string }) {
  return (
    <aside className="flex min-h-0 w-full flex-col border-l border-stone-700/80 bg-[#202326] text-stone-300 lg:w-[320px]">
      <div className="flex h-9 items-center justify-between border-b border-stone-700/70 px-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-stone-100">
          <Bell size={14} className="text-blue-300" />
          Notifications
        </div>
        <button type="button" onClick={onClose} className="text-[11px] text-stone-500 hover:text-stone-200">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="border border-blue-300/30 bg-blue-400/10 p-3">
          <p className="text-[12px] font-semibold text-blue-100">Codex waiting for input</p>
          <p className="mt-1 text-[11px] leading-4 text-stone-400">{workspaceName} needs review on the active terminal pane.</p>
          <p className="mt-2 font-mono text-[10px] text-stone-500">Shortcut: Cmd+Shift+U</p>
        </div>
      </div>
    </aside>
  );
}

function WorkspaceHeader({
  workspaceName,
  browserVisible,
  splitLayout,
  onToggleBrowser,
  onToggleSplit,
}: {
  workspaceName: string;
  browserVisible: boolean;
  splitLayout: SplitLayout;
  onToggleBrowser: () => void;
  onToggleSplit: () => void;
}) {
  return (
    <header className="flex h-9 min-w-0 items-center justify-between border-b border-stone-800 bg-[#202020] px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Folder size={13} className="shrink-0 text-sky-300" />
        <h1 className="truncate text-[13px] font-semibold text-stone-100">{workspaceName} Workspace</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-stone-400" aria-label="Right top xmux toolbar">
        <button
          type="button"
          onClick={onToggleBrowser}
          className={[
            'flex h-6 w-6 items-center justify-center rounded-sm hover:bg-white/8 hover:text-stone-100',
            browserVisible ? 'bg-sky-400/15 text-sky-200 ring-1 ring-sky-300/30' : '',
          ].join(' ')}
          aria-label="Built-in browser"
          aria-pressed={browserVisible}
          title="Built-in browser (Cmd+Shift+L)"
        >
          <Globe2 size={13} />
        </button>
        <button
          type="button"
          onClick={onToggleSplit}
          className="flex h-6 w-6 items-center justify-center rounded-sm hover:bg-white/8 hover:text-stone-100"
          aria-label="Split pane layout"
          title={splitLayout === 'vertical' ? 'Switch to horizontal split' : 'Switch to vertical split'}
        >
          <PanelsTopLeft size={14} />
        </button>
      </div>
    </header>
  );
}

function InteropConsole({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
}: {
  workspaces: WorkspaceRow[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
}) {
  const [browserVisible, setBrowserVisible] = useState(true);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [splitLayout, setSplitLayout] = useState<SplitLayout>('vertical');
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [topAreaPercent, setTopAreaPercent] = useState(72);
  const [primarySplitPercent, setPrimarySplitPercent] = useState(52);
  const rootRef = useRef<HTMLElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLDivElement | null>(null);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const hasPendingAlerts = workspaces.some((workspace) => Boolean(workspace.notification));

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const beginDrag = (onMove: (event: MouseEvent) => void, cursor: 'col-resize' | 'row-resize') => {
    const onMouseMove = (event: MouseEvent) => onMove(event);
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startSidebarResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const max = Math.min(520, Math.max(260, rect.width * 0.55));
    beginDrag((moveEvent) => {
      const next = clamp(moveEvent.clientX - rect.left, 220, max);
      setSidebarWidth(next);
    }, 'col-resize');
  };

  const startTopBottomResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const stack = stackRef.current;
    if (!stack) return;
    const rect = stack.getBoundingClientRect();
    beginDrag((moveEvent) => {
      const ratio = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setTopAreaPercent(clamp(ratio, 35, 85));
    }, 'row-resize');
  };

  const startPrimaryResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const primary = primaryRef.current;
    if (!primary || !browserVisible) return;
    const rect = primary.getBoundingClientRect();
    if (splitLayout === 'vertical') {
      beginDrag((moveEvent) => {
        const ratio = ((moveEvent.clientX - rect.left) / rect.width) * 100;
        setPrimarySplitPercent(clamp(ratio, 20, 80));
      }, 'col-resize');
      return;
    }
    beginDrag((moveEvent) => {
      const ratio = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setPrimarySplitPercent(clamp(ratio, 20, 80));
    }, 'row-resize');
  };

  const rightPaneTabs = useMemo<PaneTab[]>(
    () => [
      { label: 'Browser', icon: 'browser' },
      { label: 'New tab', icon: 'browser' },
      { label: activeWorkspace ? activeWorkspace.cwd : 'Workspace', active: true, icon: 'terminal' },
    ],
    [activeWorkspace],
  );

  return (
    <section ref={rootRef} className="flex h-full min-h-0 w-full flex-col overflow-hidden border border-stone-700/80 bg-[#1b1b1b] shadow-2xl lg:flex-row">
      <div className="shrink-0" style={{ width: `min(100%, ${sidebarWidth}px)` }}>
        <WorkspaceSidebar
          notificationOpen={notificationOpen}
          hasPendingAlerts={hasPendingAlerts}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={onSelectWorkspace}
          onToggleNotifications={() => setNotificationOpen((value) => !value)}
        />
      </div>
      <div
        className="group hidden w-1 shrink-0 cursor-col-resize bg-stone-900/70 transition-colors hover:bg-sky-400/60 lg:block"
        onMouseDown={startSidebarResize}
        title="Resize sidebar"
        aria-label="Resize workspace sidebar"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader
          workspaceName={activeWorkspace?.name ?? 'Workspace'}
          browserVisible={browserVisible}
          splitLayout={splitLayout}
          onToggleBrowser={() => setBrowserVisible((value) => !value)}
          onToggleSplit={() =>
            setSplitLayout((value) => (value === 'vertical' ? 'horizontal' : 'vertical'))
          }
        />
        <div ref={stackRef} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-[220px]" style={{ height: `${topAreaPercent}%` }}>
            <div
              ref={primaryRef}
              className={splitLayout === 'vertical' ? 'flex h-full min-h-0 min-w-0' : 'flex h-full min-h-0 min-w-0 flex-col'}
              aria-label={`${splitLayout} split workspace`}
            >
              <div
                className={splitLayout === 'vertical' ? 'min-h-0 min-w-[260px] border-r border-stone-800' : 'min-h-[180px] border-b border-stone-800'}
                style={browserVisible ? (splitLayout === 'vertical' ? { width: `${primarySplitPercent}%` } : { height: `${primarySplitPercent}%` }) : undefined}
              >
                <TerminalPaneGroup
                  paneId="terminal-a"
                  workspaceId={activeWorkspace?.id ?? 'workspace'}
                  cwd={activeWorkspace?.cwd ?? '/'}
                />
              </div>
              {browserVisible ? (
                <>
                  <div
                    className={[
                      'shrink-0 bg-stone-900/70 transition-colors hover:bg-sky-400/60',
                      splitLayout === 'vertical' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
                    ].join(' ')}
                    onMouseDown={startPrimaryResize}
                    title={splitLayout === 'vertical' ? 'Resize terminal/browser width' : 'Resize terminal/browser height'}
                    aria-label="Resize terminal browser split"
                  />
                  <div className="min-h-0 min-w-0 flex-1">
                    <PaneTabs tabs={rightPaneTabs} />
                    <BrowserPane />
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <div
            className="h-1 shrink-0 cursor-row-resize bg-stone-900/70 transition-colors hover:bg-sky-400/60"
            onMouseDown={startTopBottomResize}
            title="Resize top and bottom terminals"
            aria-label="Resize terminal rows"
          />
          <div className="min-h-[150px] min-w-0 flex-1 border-t border-stone-800">
            <TerminalPaneGroup
              paneId="terminal-b"
              workspaceId={activeWorkspace?.id ?? 'workspace'}
              cwd={activeWorkspace?.cwd ?? '/'}
            />
          </div>
        </div>
      </div>
      {notificationOpen ? (
        <NotificationPanel
          onClose={() => setNotificationOpen(false)}
          workspaceName={activeWorkspace?.name ?? 'Workspace'}
        />
      ) : null}
    </section>
  );
}

export function XmuxView({
  projects,
  selectedDashboardProjectIds,
  selectedProjectId,
}: XmuxViewProps = {}) {
  const hasRealProjects = Boolean(projects && projects.length > 0);
  const dashboardScopedIds = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    const validIds = new Set(projects.map((project) => project.id));
    return (selectedDashboardProjectIds ?? []).filter((id) => validIds.has(id));
  }, [projects, selectedDashboardProjectIds]);
  const hasDashboardSelection = dashboardScopedIds.length > 0;
  const [workspaceScope, setWorkspaceScope] = useState<WorkspaceScope>(
    hasDashboardSelection ? 'dashboard' : 'all',
  );
  const workspaces = useMemo(
    () => deriveWorkspaceRows(projects, dashboardScopedIds, selectedProjectId, workspaceScope),
    [projects, dashboardScopedIds, selectedProjectId, workspaceScope],
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(workspaces[0]?.id ?? '');
  const lastSyncedProjectIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!hasDashboardSelection && workspaceScope === 'dashboard') {
      setWorkspaceScope('all');
    }
  }, [hasDashboardSelection, workspaceScope]);

  useEffect(() => {
    if (
      selectedProjectId &&
      selectedProjectId !== lastSyncedProjectIdRef.current &&
      workspaces.some((workspace) => workspace.id === selectedProjectId)
    ) {
      setActiveWorkspaceId(selectedProjectId);
    }
    lastSyncedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId, workspaces]);

  useEffect(() => {
    if (!workspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
      setActiveWorkspaceId(workspaces[0]?.id ?? '');
    }
  }, [activeWorkspaceId, workspaces]);

  return (
    <section className="flex h-full w-full flex-col gap-3">
      <div className="rounded border border-stone-700/70 bg-[#202326] px-3 py-2 text-[11px] text-stone-300">
        <h1 className="text-[13px] font-semibold text-stone-100">xmux</h1>
        <p className="mt-1">xmux -&gt; cmux</p>
        <p>xmux does not prescribe how developers must use AI.</p>
        <p>
          Terminal panes use native PTY + GPU xterm (WebGL) today; Phase 2 targets libghostty rendering like cmux.
        </p>
        <div className="mt-1 flex gap-3 text-stone-400">
          <span>Built-In Browser</span>
          <span>Notification Panel</span>
          <span>Split Pane Layout</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-stone-400">顯示範圍：</span>
          <button
            type="button"
            onClick={() => setWorkspaceScope('dashboard')}
            disabled={!hasDashboardSelection}
            className={[
              'rounded border px-2 py-0.5 transition-colors',
              workspaceScope === 'dashboard'
                ? 'border-sky-300/60 bg-sky-400/15 text-sky-100'
                : 'border-stone-600/70 text-stone-300 hover:border-stone-500',
              !hasDashboardSelection ? 'cursor-not-allowed opacity-45' : '',
            ].join(' ')}
          >
            只顯示 dashboard 勾選專案 ({dashboardScopedIds.length})
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceScope('all')}
            className={[
              'rounded border px-2 py-0.5 transition-colors',
              workspaceScope === 'all'
                ? 'border-emerald-300/60 bg-emerald-400/15 text-emerald-100'
                : 'border-stone-600/70 text-stone-300 hover:border-stone-500',
            ].join(' ')}
          >
            顯示全部專案 ({projects?.length ?? fallbackWorkspaces.length})
          </button>
          <span className="text-stone-500">
            目前：
            {workspaceScope === 'dashboard'
              ? ' 只顯示 dashboard 勾選專案'
              : ' 顯示全部專案'}
          </span>
        </div>
        {workspaceScope === 'dashboard' && !hasDashboardSelection && hasRealProjects ? (
          <p className="mt-1 text-amber-200/80">
            Dashboard 目前沒有勾選專案，已自動切回「顯示全部專案」。
          </p>
        ) : null}
      </div>
      {workspaces.length === 0 ? (
        <div className="flex h-full min-h-[280px] items-center justify-center rounded border border-stone-700/80 bg-[#1b1b1b] text-stone-400">
          目前沒有可顯示的 workspace，請先在 Project Dashboard 勾選專案或切換為「顯示全部專案」。
        </div>
      ) : (
        <InteropConsole
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={setActiveWorkspaceId}
        />
      )}
    </section>
  );
}
