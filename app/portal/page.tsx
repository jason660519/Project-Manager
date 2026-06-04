import { WorkspaceAccessSurface } from '../auth/WorkspaceAccessSurface';

export default function UserPortalPage() {
  return (
    <WorkspaceAccessSurface
      title="User Portal"
      description="Review project progress, requirements, reports, and solution detail pages without local command execution."
      requiredCapability="view:portal"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border border-stone-200/15 bg-stone-100/5 p-3">
          <h2 className="text-sm font-semibold text-stone-100">Progress</h2>
          <p className="mt-1 text-xs leading-5 text-stone-400">Read workspace project status.</p>
        </div>
        <div className="rounded border border-stone-200/15 bg-stone-100/5 p-3">
          <h2 className="text-sm font-semibold text-stone-100">Reports</h2>
          <p className="mt-1 text-xs leading-5 text-stone-400">Open delivery summaries.</p>
        </div>
        <div className="rounded border border-stone-200/15 bg-stone-100/5 p-3">
          <h2 className="text-sm font-semibold text-stone-100">Solutions</h2>
          <p className="mt-1 text-xs leading-5 text-stone-400">Open solution detail URLs.</p>
        </div>
      </div>
    </WorkspaceAccessSurface>
  );
}
