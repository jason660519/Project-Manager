'use client';

import { WorkspaceAccessSurface } from '../auth/WorkspaceAccessSurface';
import { useWorkspaceSession } from '../../lib/auth/workspaceSession';
import { AdminAuditLogsPanel } from './AdminAuditLogsPanel';
import { AdminMembersPanel } from './AdminMembersPanel';

export function AdminPageClient() {
  const {
    signedIn,
    userId,
    role,
    loading,
    workspaceId,
    workspaceName,
    memberships,
    setActiveWorkspaceId,
  } = useWorkspaceSession();

  return (
    <WorkspaceAccessSurface
      title="Admin Console"
      description="Manage workspace members, role policies, integrations, settings, and audit history."
      requiredCapability="view:admin-console"
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
            <h2 className="text-sm font-semibold text-stone-100">Members</h2>
            <p className="mt-1 text-xs leading-5 text-stone-400">Assign workspace roles.</p>
          </div>
          <div className="rounded border border-stone-200/15 bg-stone-100/5 p-3">
            <h2 className="text-sm font-semibold text-stone-100">Integrations</h2>
            <p className="mt-1 text-xs leading-5 text-stone-400">Review connected services.</p>
          </div>
          <div className="rounded border border-stone-200/15 bg-stone-100/5 p-3">
            <h2 className="text-sm font-semibold text-stone-100">Audit</h2>
            <p className="mt-1 text-xs leading-5 text-stone-400">Inspect access and run events.</p>
          </div>
        </div>

        <AdminMembersPanel workspaceRole={role} workspaceId={workspaceId} actorUserId={userId} />
        <AdminAuditLogsPanel workspaceRole={role} workspaceId={workspaceId} />
      </div>
    </WorkspaceAccessSurface>
  );
}
