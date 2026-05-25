'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Bell, Folder, Globe2, PanelsTopLeft } from 'lucide-react';
import { TerminalPaneGroup } from '../../../components/terminal/TerminalPaneGroup';
import type { PaneActions } from '../../../components/terminal/PaneShell';
import { BrowserPane, type BrowserTab } from '../../../components/browser/BrowserPane';
import type { ProjectEntry } from '../../../lib/types';

interface WorkspaceRow {
  id: string;
  name: string;
  branch: string;
  cwd: string;
  notification?: string;
  homepageUrl: string;
}

const DEFAULT_HOMEPAGE = 'http://localhost:43187/project-progress-dashboard';
const MAX_BROWSER_TABS_PER_WORKSPACE = 8;

function deriveHomepage(project: ProjectEntry): string {
  const github = project.config.project.githubUrl;
  if (github && /^https?:\/\//i.test(github)) return github;
  return DEFAULT_HOMEPAGE;
}

interface XmuxViewProps {
  projects?: ProjectEntry[];
  selectedDashboardProjectIds?: string[];
  selectedProjectId?: string;
}

type SplitLayout = 'vertical' | 'horizontal';
type DragCursor = 'col-resize' | 'row-resize' | null;

interface WorkspaceBrowserState {
  tabs: BrowserTab[];
  activeTabId: string;
}

const fallbackWorkspaces: WorkspaceRow[] = [
  {
    id: 'project-manager',
    name: 'Project Management',
    branch: 'dispatch-wip-20260525*',
    cwd: '/Volumes/KLEVV-4T-1/Project-Manager',
    notification: 'xmux review requested',
    homepageUrl: DEFAULT_HOMEPAGE,
  },
  {
    id: 'realestate-management-apps',
    name: 'Realestate_Management_Apps',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/Realestate_Management_Apps',
    notification: 'Codex waiting for input',
    homepageUrl: DEFAULT_HOMEPAGE,
  },
  {
    id: 'comfy-ui',
    name: 'ComfyUI',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/Real Estate Management',
    homepageUrl: DEFAULT_HOMEPAGE,
  },
  {
    id: 'saydo',
    name: 'SayDo',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/SayDo',
    homepageUrl: DEFAULT_HOMEPAGE,
  },
  {
    id: 'company-ai-app-standards',
    name: 'Company-AI-App-Standards',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/Company-AI-App-Standards',
    homepageUrl: DEFAULT_HOMEPAGE,
  },
];

function deriveWorkspaceRows(
  projects: ProjectEntry[] | undefined,
  selectedDashboardProjectIds: string[] | undefined,
  selectedProjectId: string | undefined,
): WorkspaceRow[] {
  if (!projects || projects.length === 0) {
    return fallbackWorkspaces;
  }

  const byId = new Map(projects.map((project) => [project.id, project]));
  const dashboardProjects = (selectedDashboardProjectIds ?? [])
    .map((id) => byId.get(id))
    .filter((project): project is ProjectEntry => Boolean(project));
  const source = dashboardProjects;

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
      homepageUrl: deriveHomepage(project),
    };
  });
}

function seedWorkspaceBrowserState(homepageUrl: string): WorkspaceBrowserState {
  const tab: BrowserTab = {
    id: `browser-tab-${Date.now()}`,
    label: deriveTabLabel(homepageUrl),
    url: homepageUrl,
  };
  return { tabs: [tab], activeTabId: tab.id };
}

function deriveTabLabel(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname) return u.hostname.replace(/^www\./, '');
    return url;
  } catch {
    return url;
  }
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
  const [dragCursor, setDragCursor] = useState<DragCursor>(null);
  const [browserState, setBrowserState] = useState<Record<string, WorkspaceBrowserState>>({});

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const homepageUrl = activeWorkspace?.homepageUrl ?? DEFAULT_HOMEPAGE;
  const hasPendingAlerts = workspaces.some((workspace) => Boolean(workspace.notification));

  const rootRef = useRef<HTMLElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    setBrowserState((current) => {
      if (current[activeWorkspace.id]) return current;
      return { ...current, [activeWorkspace.id]: seedWorkspaceBrowserState(activeWorkspace.homepageUrl) };
    });
  }, [activeWorkspace]);

  const activeBrowserState = activeWorkspace ? browserState[activeWorkspace.id] : undefined;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const beginDrag = useCallback(
    (onMove: (event: MouseEvent) => void, cursor: 'col-resize' | 'row-resize') => {
      let frameId: number | null = null;
      let latest: MouseEvent | null = null;

      const flush = () => {
        frameId = null;
        if (latest) onMove(latest);
      };

      const onMouseMove = (event: MouseEvent) => {
        latest = event;
        if (frameId === null) {
          frameId = requestAnimationFrame(flush);
        }
      };
      const onMouseUp = () => {
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
        if (latest) onMove(latest);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.userSelect = '';
        setDragCursor(null);
      };
      document.body.style.userSelect = 'none';
      setDragCursor(cursor);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [],
  );

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

  const appendBrowserTab = useCallback(
    (workspaceId: string, workspaceHomepage: string) => {
      setBrowserState((current) => {
        const existing = current[workspaceId] ?? { tabs: [], activeTabId: '' };
        if (existing.tabs.length >= MAX_BROWSER_TABS_PER_WORKSPACE) return current;
        const id = `browser-tab-${Date.now()}-${existing.tabs.length + 1}`;
        const tab: BrowserTab = {
          id,
          label: deriveTabLabel(workspaceHomepage),
          url: workspaceHomepage,
        };
        return {
          ...current,
          [workspaceId]: {
            tabs: [...existing.tabs, tab],
            activeTabId: id,
          },
        };
      });
    },
    [],
  );

  const handleSelectBrowserTab = useCallback(
    (tabId: string) => {
      if (!activeWorkspace) return;
      setBrowserState((current) => {
        const existing = current[activeWorkspace.id];
        if (!existing) return current;
        if (existing.activeTabId === tabId) return current;
        return {
          ...current,
          [activeWorkspace.id]: { ...existing, activeTabId: tabId },
        };
      });
    },
    [activeWorkspace],
  );

  const handleCloseBrowserTab = useCallback(
    (tabId: string) => {
      if (!activeWorkspace) return;
      setBrowserState((current) => {
        const existing = current[activeWorkspace.id];
        if (!existing || existing.tabs.length <= 1) return current;
        const next = existing.tabs.filter((tab) => tab.id !== tabId);
        const nextActive =
          existing.activeTabId === tabId ? next[0]?.id ?? '' : existing.activeTabId;
        return {
          ...current,
          [activeWorkspace.id]: { tabs: next, activeTabId: nextActive },
        };
      });
    },
    [activeWorkspace],
  );

  const handleNavigateBrowserTab = useCallback(
    (tabId: string, url: string) => {
      if (!activeWorkspace) return;
      setBrowserState((current) => {
        const existing = current[activeWorkspace.id];
        if (!existing) return current;
        const tabs = existing.tabs.map((tab) =>
          tab.id === tabId ? { ...tab, url, label: deriveTabLabel(url) } : tab,
        );
        return { ...current, [activeWorkspace.id]: { ...existing, tabs } };
      });
    },
    [activeWorkspace],
  );

  const openBrowserHomepage = useCallback(() => {
    if (!activeWorkspace) return;
    setBrowserVisible(true);
    appendBrowserTab(activeWorkspace.id, activeWorkspace.homepageUrl);
  }, [activeWorkspace, appendBrowserTab]);

  const splitRight = useCallback(() => {
    setBrowserVisible(true);
    setSplitLayout('vertical');
  }, []);

  const splitDown = useCallback(() => {
    setBrowserVisible(true);
    setSplitLayout('horizontal');
  }, []);

  const terminalPaneActions: PaneActions = useMemo(
    () => ({
      onAddBrowser: openBrowserHomepage,
      onSplitRight: splitRight,
      onSplitDown: splitDown,
    }),
    [openBrowserHomepage, splitRight, splitDown],
  );

  const browserPaneActions: PaneActions = useMemo(
    () => ({
      onAddBrowser: openBrowserHomepage,
      onSplitRight: splitRight,
      onSplitDown: splitDown,
    }),
    [openBrowserHomepage, splitRight, splitDown],
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
        className="hidden w-1.5 shrink-0 cursor-col-resize bg-stone-900 transition-colors hover:bg-sky-400/60 lg:block"
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
          <div className="min-h-[220px] min-w-0" style={{ height: `${topAreaPercent}%` }}>
            <div
              ref={primaryRef}
              className={splitLayout === 'vertical' ? 'flex h-full min-h-0 min-w-0' : 'flex h-full min-h-0 min-w-0 flex-col'}
              aria-label={`${splitLayout} split workspace`}
            >
              <div
                className="min-h-0 min-w-[260px]"
                style={browserVisible ? (splitLayout === 'vertical' ? { width: `${primarySplitPercent}%` } : { height: `${primarySplitPercent}%`, minHeight: 180 }) : undefined}
              >
                <TerminalPaneGroup
                  paneId="terminal-a"
                  workspaceId={activeWorkspace?.id ?? 'workspace'}
                  cwd={activeWorkspace?.cwd ?? '/'}
                  actions={terminalPaneActions}
                />
              </div>
              {browserVisible && activeBrowserState ? (
                <>
                  <div
                    className={[
                      'shrink-0 bg-stone-900 transition-colors hover:bg-sky-400/60',
                      splitLayout === 'vertical' ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize',
                    ].join(' ')}
                    onMouseDown={startPrimaryResize}
                    title={splitLayout === 'vertical' ? 'Resize terminal/browser width' : 'Resize terminal/browser height'}
                    aria-label="Resize terminal browser split"
                  />
                  <div className="min-h-0 min-w-0 flex-1">
                    <BrowserPane
                      tabs={activeBrowserState.tabs}
                      activeTabId={activeBrowserState.activeTabId}
                      homepageUrl={homepageUrl}
                      onSelectTab={handleSelectBrowserTab}
                      onCloseTab={handleCloseBrowserTab}
                      onNavigate={handleNavigateBrowserTab}
                      actions={browserPaneActions}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <div
            className="h-1.5 shrink-0 cursor-row-resize bg-stone-900 transition-colors hover:bg-sky-400/60"
            onMouseDown={startTopBottomResize}
            title="Resize top and bottom terminals"
            aria-label="Resize terminal rows"
          />
          <div className="min-h-[150px] min-w-0 flex-1">
            <TerminalPaneGroup
              paneId="terminal-b"
              workspaceId={activeWorkspace?.id ?? 'workspace'}
              cwd={activeWorkspace?.cwd ?? '/'}
              actions={terminalPaneActions}
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
      {dragCursor ? (
        <div
          data-resize-overlay
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            cursor: dragCursor,
            zIndex: 50,
          }}
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
  const dashboardScopedIds = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    const validIds = new Set(projects.map((project) => project.id));
    return (selectedDashboardProjectIds ?? []).filter((id) => validIds.has(id));
  }, [projects, selectedDashboardProjectIds]);
  const workspaces = useMemo(
    () => deriveWorkspaceRows(projects, dashboardScopedIds, selectedProjectId),
    [projects, dashboardScopedIds, selectedProjectId],
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(workspaces[0]?.id ?? '');
  const lastSyncedProjectIdRef = useRef<string | undefined>(undefined);

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
      {workspaces.length === 0 ? (
        <div className="flex h-full min-h-[280px] items-center justify-center rounded border border-stone-700/80 bg-[#1b1b1b] text-stone-400">
          目前沒有可顯示的 workspace，請先在 Project Dashboard 勾選專案。
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
