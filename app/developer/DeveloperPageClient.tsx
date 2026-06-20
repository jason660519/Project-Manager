'use client';

import { WorkspaceAccessSurface } from '../auth/WorkspaceAccessSurface';
import { useWorkspaceSession } from '../../lib/auth/workspaceSession';
import { DeveloperAgentRunsPanel } from './DeveloperAgentRunsPanel';
import { DeveloperRunnersPanel } from './DeveloperRunnersPanel';
import { DeveloperSyncCursorsPanel } from './DeveloperSyncCursorsPanel';

export function DeveloperPageClient() {
  const {
    signedIn,
    role,
    loading,
    workspaceId,
    workspaceName,
    memberships,
    setActiveWorkspaceId,
  } = useWorkspaceSession();

  return (
    <WorkspaceAccessSurface
      title="Developer Console"
      description="Connect a local runner, manage engineering projects, dispatch guarded agent work, and inspect execution logs."
      requiredCapability="view:developer-console"
      currentRole={role}
      signedIn={signedIn}
      activeWorkspaceId={workspaceId}
      activeWorkspaceName={workspaceName}
      memberships={memberships}
      onWorkspaceSelect={setActiveWorkspaceId}
      sessionPending={loading}
    >
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border border-stone-200/15 bg-stone-100/5 p-3">
            <h2 className="text-sm font-semibold text-stone-100">Runner</h2>
            <p className="mt-1 text-xs leading-5 text-stone-400">Pair local Developer Runner.</p>
          </div>
          <div className="rounded border border-stone-200/15 bg-stone-100/5 p-3">
            <h2 className="text-sm font-semibold text-stone-100">Dispatch</h2>
            <p className="mt-1 text-xs leading-5 text-stone-400">Review prompts before execution.</p>
          </div>
          <div className="rounded border border-stone-200/15 bg-stone-100/5 p-3">
            <h2 className="text-sm font-semibold text-stone-100">Logs</h2>
            <p className="mt-1 text-xs leading-5 text-stone-400">Inspect run metadata and artifacts.</p>
          </div>
        </div>

        <DeveloperRunnersPanel workspaceRole={role} workspaceId={workspaceId} />
        <DeveloperSyncCursorsPanel workspaceRole={role} workspaceId={workspaceId} />
        <DeveloperAgentRunsPanel workspaceRole={role} workspaceId={workspaceId} />
      </div>
    </WorkspaceAccessSurface>
  );
}
