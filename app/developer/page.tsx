import { WorkspaceAccessSurface } from '../auth/WorkspaceAccessSurface';

export default function DeveloperConsolePage() {
  return (
    <WorkspaceAccessSurface
      title="Developer Console"
      description="Connect a local runner, manage engineering projects, dispatch guarded agent work, and inspect execution logs."
      requiredCapability="view:developer-console"
    >
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
    </WorkspaceAccessSurface>
  );
}
