'use client';

import type { WorkspaceMembership } from '../../lib/auth/workspaceMemberships';

interface WorkspacePickerProps {
  memberships: WorkspaceMembership[];
  activeWorkspaceId: string | null;
  onSelect: (workspaceId: string) => void;
  disabled?: boolean;
}

export function WorkspacePicker({
  memberships,
  activeWorkspaceId,
  onSelect,
  disabled = false,
}: WorkspacePickerProps) {
  if (memberships.length <= 1) {
    return null;
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-stone-400">
      Active workspace
      <select
        value={activeWorkspaceId ?? ''}
        disabled={disabled}
        onChange={(event) => {
          const nextWorkspaceId = event.target.value;
          if (nextWorkspaceId) {
            onSelect(nextWorkspaceId);
          }
        }}
        className="rounded border border-stone-200/20 bg-stone-950/40 px-3 py-2 text-sm text-stone-100"
      >
        {memberships.map((membership) => (
          <option key={membership.workspaceId} value={membership.workspaceId}>
            {membership.workspaceName} ({membership.role})
          </option>
        ))}
      </select>
    </label>
  );
}
