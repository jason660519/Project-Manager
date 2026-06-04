import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoginEntry } from '../app/login/LoginEntry';
import {
  getDeniedCapabilityMessage,
  getRoleConsoleLabel,
  resolveWorkspaceDestination,
  roleHasCapability,
} from '../lib/auth/permissions';

describe('Supabase role routing and permission scaffolding', () => {
  it('routes workspace roles to the correct product surfaces', () => {
    expect(resolveWorkspaceDestination('owner')).toBe('/admin');
    expect(resolveWorkspaceDestination('admin')).toBe('/admin');
    expect(resolveWorkspaceDestination('developer')).toBe('/developer');
    expect(resolveWorkspaceDestination('reviewer')).toBe('/portal');
    expect(resolveWorkspaceDestination('viewer')).toBe('/portal');
    expect(resolveWorkspaceDestination('user')).toBe('/portal');
    expect(resolveWorkspaceDestination(null)).toBe('/login?state=missing-membership');
  });

  it('keeps Developer capabilities away from general Users', () => {
    expect(roleHasCapability('developer', 'agent:dispatch')).toBe(true);
    expect(roleHasCapability('developer', 'runner:pair')).toBe(true);
    expect(roleHasCapability('user', 'agent:dispatch')).toBe(false);
    expect(roleHasCapability('viewer', 'keys:manage')).toBe(false);
    expect(roleHasCapability('reviewer', 'settings:manage')).toBe(false);
    expect(roleHasCapability('admin', 'members:manage')).toBe(true);
  });

  it('uses explicit console labels and denial messages', () => {
    expect(getRoleConsoleLabel('developer')).toBe('Developer Console');
    expect(getRoleConsoleLabel('user')).toBe('User Portal');
    expect(getRoleConsoleLabel('owner')).toBe('Admin Console');
    expect(getRoleConsoleLabel(undefined)).toBe('Workspace access required');
    expect(getDeniedCapabilityMessage('agent:dispatch')).toContain('Developer permission');
  });

  it('renders login setup state without exposing privileged controls', () => {
    render(<LoginEntry />);

    expect(screen.getByRole('heading', { name: /Project Manager Cloud Sign In/i })).toBeInTheDocument();
    expect(screen.getByText(/Supabase setup required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with GitHub/i })).toBeDisabled();
    expect(screen.getByText(/Developer Console/i)).toBeInTheDocument();
    expect(screen.getByText(/User Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Service-role keys must never be exposed/i)).toBeInTheDocument();
  });
});
