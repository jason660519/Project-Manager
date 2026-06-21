import { getSupabaseBrowserClient } from './supabaseClient';

export interface CreatedWorkspace {
  id: string;
  name: string;
  createdAt: string;
}

export interface CreateWorkspaceResult {
  workspace: CreatedWorkspace | null;
  error: string | null;
}

type WorkspaceRow = {
  id?: unknown;
  name?: unknown;
  created_at?: unknown;
};

export type WorkspaceCreateClient = {
  rpc: (
    fn: 'pm_create_workspace',
    args: { p_name: string },
  ) => Promise<{ data: WorkspaceRow | null; error: { message?: string } | null }>;
};

function normalizeWorkspaceRow(data: WorkspaceRow | null): CreatedWorkspace | null {
  if (
    !data ||
    typeof data.id !== 'string' ||
    typeof data.name !== 'string' ||
    typeof data.created_at !== 'string'
  ) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
  };
}

export async function createWorkspace(
  name: string,
  client: WorkspaceCreateClient = getSupabaseBrowserClient() as unknown as WorkspaceCreateClient,
): Promise<CreateWorkspaceResult> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return {
      workspace: null,
      error: 'Workspace name is required.',
    };
  }

  if (trimmedName.length > 200) {
    return {
      workspace: null,
      error: 'Workspace name must be 200 characters or fewer.',
    };
  }

  try {
    const { data, error } = await client.rpc('pm_create_workspace', {
      p_name: trimmedName,
    });

    if (error) {
      return {
        workspace: null,
        error: error.message || 'Workspace creation failed.',
      };
    }

    const workspace = normalizeWorkspaceRow(data);
    if (!workspace) {
      return {
        workspace: null,
        error: 'Workspace creation returned malformed data.',
      };
    }

    return {
      workspace,
      error: null,
    };
  } catch (error) {
    return {
      workspace: null,
      error: error instanceof Error ? error.message : 'Workspace creation failed.',
    };
  }
}
