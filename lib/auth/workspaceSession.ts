'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  clearStoredActiveWorkspaceId,
  readStoredActiveWorkspaceId,
  writeStoredActiveWorkspaceId,
} from './activeWorkspaceStorage';
import type { WorkspaceRole } from './permissions';
import { isSupabaseConfigured } from './supabaseClient';
import {
  readSupabaseAuthUser,
  signOutSupabaseAuth,
  subscribeSupabaseAuthChanges,
} from './supabaseAuthSession';
import {
  listWorkspaceMemberships,
  type WorkspaceMembership,
  type WorkspaceMembershipClient,
} from './workspaceMemberships';

export interface WorkspaceSessionState {
  signedIn: boolean;
  userId: string | null;
  userEmail: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  role: WorkspaceRole | null;
  memberships: WorkspaceMembership[];
  loading: boolean;
  error: string | null;
  setActiveWorkspaceId: (workspaceId: string) => void;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function resolveActiveWorkspaceMembership(
  memberships: WorkspaceMembership[],
  preferredWorkspaceId?: string | null,
): WorkspaceMembership | null {
  if (memberships.length === 0) {
    return null;
  }

  if (preferredWorkspaceId) {
    const preferred = memberships.find(
      (membership) => membership.workspaceId === preferredWorkspaceId,
    );
    if (preferred) {
      return preferred;
    }
  }

  return memberships[0] ?? null;
}

export async function resolveActiveWorkspaceSession(
  client?: WorkspaceMembershipClient,
  preferredWorkspaceId?: string | null,
): Promise<{
  workspaceId: string | null;
  workspaceName: string | null;
  role: WorkspaceRole | null;
  memberships: WorkspaceMembership[];
  error: string | null;
}> {
  const result = await listWorkspaceMemberships(client);
  if (result.error) {
    return {
      workspaceId: null,
      workspaceName: null,
      role: null,
      memberships: [],
      error: result.error,
    };
  }

  const activeMembership = resolveActiveWorkspaceMembership(
    result.memberships,
    preferredWorkspaceId,
  );
  if (!activeMembership) {
    return {
      workspaceId: null,
      workspaceName: null,
      role: null,
      memberships: result.memberships,
      error: null,
    };
  }

  return {
    workspaceId: activeMembership.workspaceId,
    workspaceName: activeMembership.workspaceName,
    role: activeMembership.role,
    memberships: result.memberships,
    error: null,
  };
}

/** @deprecated Use resolveActiveWorkspaceSession for workspace-aware session resolution. */
export async function resolveActiveWorkspaceRole(
  client?: WorkspaceMembershipClient,
): Promise<{
  role: WorkspaceRole | null;
  error: string | null;
}> {
  const session = await resolveActiveWorkspaceSession(client);
  return {
    role: session.role,
    error: session.error,
  };
}

const EMPTY_SESSION: Omit<WorkspaceSessionState, 'setActiveWorkspaceId' | 'refreshSession' | 'signOut'> = {
  signedIn: false,
  userId: null,
  userEmail: null,
  workspaceId: null,
  workspaceName: null,
  role: null,
  memberships: [],
  loading: false,
  error: null,
};

export function useWorkspaceSession(): WorkspaceSessionState {
  const [state, setState] = useState<
    Omit<WorkspaceSessionState, 'setActiveWorkspaceId' | 'refreshSession' | 'signOut'>
  >({
    ...EMPTY_SESSION,
    loading: true,
  });

  const loadSession = useCallback(async (cancelledRef?: { current: boolean }) => {
    const cancelled = () => cancelledRef?.current === true;

    if (!isSupabaseConfigured()) {
      if (!cancelled()) {
        setState({
          ...EMPTY_SESSION,
          loading: false,
        });
      }
      return;
    }

    if (!cancelled()) {
      setState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));
    }

    try {
      const auth = await readSupabaseAuthUser();
      if (cancelled()) return;

      if (auth.error) {
        setState({
          ...EMPTY_SESSION,
          loading: false,
          error: auth.error,
        });
        return;
      }

      if (!auth.user) {
        setState({
          ...EMPTY_SESSION,
          loading: false,
        });
        return;
      }

      const preferredWorkspaceId = readStoredActiveWorkspaceId();
      const session = await resolveActiveWorkspaceSession(undefined, preferredWorkspaceId);
      if (cancelled()) return;

      if (session.workspaceId) {
        writeStoredActiveWorkspaceId(session.workspaceId);
      }

      setState({
        signedIn: true,
        userId: auth.user.id,
        userEmail: auth.user.email,
        workspaceId: session.workspaceId,
        workspaceName: session.workspaceName,
        role: session.role,
        memberships: session.memberships,
        loading: false,
        error: session.error,
      });
    } catch (error) {
      if (!cancelled()) {
        setState({
          ...EMPTY_SESSION,
          loading: false,
          error: error instanceof Error ? error.message : 'Workspace session lookup failed.',
        });
      }
    }
  }, []);

  const setActiveWorkspaceId = useCallback((workspaceId: string) => {
    writeStoredActiveWorkspaceId(workspaceId);
    setState((current) => {
      const membership = resolveActiveWorkspaceMembership(current.memberships, workspaceId);
      if (!membership) {
        return {
          ...current,
          error: 'Selected workspace is not available for this account.',
        };
      }

      return {
        ...current,
        workspaceId: membership.workspaceId,
        workspaceName: membership.workspaceName,
        role: membership.role,
        error: null,
      };
    });
  }, []);

  const signOut = useCallback(async () => {
    clearStoredActiveWorkspaceId();
    const result = await signOutSupabaseAuth();
    setState({
      ...EMPTY_SESSION,
      error: result.error,
    });
  }, []);

  const refreshSession = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  useEffect(() => {
    const cancelledRef = { current: false };

    void loadSession(cancelledRef);

    if (!isSupabaseConfigured()) {
      return () => {
        cancelledRef.current = true;
      };
    }

    const unsubscribe = subscribeSupabaseAuthChanges(() => {
      void loadSession(cancelledRef);
    });

    return () => {
      cancelledRef.current = true;
      unsubscribe();
    };
  }, [loadSession]);

  return {
    ...state,
    setActiveWorkspaceId,
    refreshSession,
    signOut,
  };
}
