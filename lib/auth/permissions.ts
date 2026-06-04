export type WorkspaceRole = 'owner' | 'admin' | 'developer' | 'reviewer' | 'viewer' | 'user';

export type ProjectManagerCapability =
  | 'view:portal'
  | 'view:developer-console'
  | 'view:admin-console'
  | 'project:read'
  | 'project:write'
  | 'feature:write'
  | 'report:read'
  | 'solution:read'
  | 'agent:dispatch'
  | 'runner:pair'
  | 'keys:manage'
  | 'settings:manage'
  | 'members:manage'
  | 'audit:read';

const ROLE_CAPABILITIES: Record<WorkspaceRole, ReadonlySet<ProjectManagerCapability>> = {
  owner: new Set([
    'view:portal',
    'view:developer-console',
    'view:admin-console',
    'project:read',
    'project:write',
    'feature:write',
    'report:read',
    'solution:read',
    'agent:dispatch',
    'runner:pair',
    'keys:manage',
    'settings:manage',
    'members:manage',
    'audit:read',
  ]),
  admin: new Set([
    'view:portal',
    'view:developer-console',
    'view:admin-console',
    'project:read',
    'project:write',
    'feature:write',
    'report:read',
    'solution:read',
    'agent:dispatch',
    'runner:pair',
    'keys:manage',
    'settings:manage',
    'members:manage',
    'audit:read',
  ]),
  developer: new Set([
    'view:portal',
    'view:developer-console',
    'project:read',
    'project:write',
    'feature:write',
    'report:read',
    'solution:read',
    'agent:dispatch',
    'runner:pair',
  ]),
  reviewer: new Set([
    'view:portal',
    'project:read',
    'report:read',
    'solution:read',
  ]),
  viewer: new Set([
    'view:portal',
    'project:read',
    'report:read',
    'solution:read',
  ]),
  user: new Set([
    'view:portal',
    'project:read',
    'report:read',
    'solution:read',
  ]),
};

export function roleHasCapability(
  role: WorkspaceRole | null | undefined,
  capability: ProjectManagerCapability,
): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.has(capability) ?? false;
}

export function resolveWorkspaceDestination(role: WorkspaceRole | null | undefined): string {
  if (role === 'owner' || role === 'admin') return '/admin';
  if (role === 'developer') return '/developer';
  if (role === 'reviewer' || role === 'viewer' || role === 'user') return '/portal';
  return '/login?state=missing-membership';
}

export function getRoleConsoleLabel(role: WorkspaceRole | null | undefined): string {
  if (role === 'owner' || role === 'admin') return 'Admin Console';
  if (role === 'developer') return 'Developer Console';
  if (role === 'reviewer') return 'Review Portal';
  if (role === 'viewer' || role === 'user') return 'User Portal';
  return 'Workspace access required';
}

export function getDeniedCapabilityMessage(capability: ProjectManagerCapability): string {
  switch (capability) {
    case 'agent:dispatch':
      return 'Agent dispatch requires Developer permission and a connected runner.';
    case 'runner:pair':
      return 'Runner pairing is available to Developers and workspace admins only.';
    case 'keys:manage':
      return 'API key management is restricted to trusted technical roles.';
    case 'settings:manage':
      return 'Workspace settings require admin-level permission.';
    case 'members:manage':
      return 'Member management requires Admin or Owner permission.';
    case 'audit:read':
      return 'Audit logs require Admin or Owner permission.';
    default:
      return 'Your workspace role does not grant this capability.';
  }
}

export type WorkspaceAccessStatus =
  | 'setup_required'
  | 'membership_required'
  | 'allowed'
  | 'denied';

export interface WorkspaceAccessInput {
  supabaseConfigured: boolean;
  role?: WorkspaceRole | null;
  requiredCapability: ProjectManagerCapability;
}

export interface WorkspaceAccessResult {
  status: WorkspaceAccessStatus;
  message: string;
}

export function evaluateWorkspaceAccess({
  supabaseConfigured,
  role,
  requiredCapability,
}: WorkspaceAccessInput): WorkspaceAccessResult {
  if (!supabaseConfigured) {
    return {
      status: 'setup_required',
      message: 'Supabase cloud auth is not configured for this environment.',
    };
  }

  if (!role) {
    return {
      status: 'membership_required',
      message: 'Sign in and select a workspace before opening this console.',
    };
  }

  if (!roleHasCapability(role, requiredCapability)) {
    return {
      status: 'denied',
      message: getDeniedCapabilityMessage(requiredCapability),
    };
  }

  return {
    status: 'allowed',
    message: `${getRoleConsoleLabel(role)} access granted.`,
  };
}
