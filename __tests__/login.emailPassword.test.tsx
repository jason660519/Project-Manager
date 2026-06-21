import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginEntry } from '../app/login/LoginEntry';

vi.mock('../lib/auth/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseBrowserClient: vi.fn(),
}));

vi.mock('../lib/auth/supabaseAuthSession', async () => {
  const actual = await vi.importActual<typeof import('../lib/auth/supabaseAuthSession')>(
    '../lib/auth/supabaseAuthSession',
  );
  return {
    ...actual,
    signInWithEmailPassword: vi.fn(),
  };
});

vi.mock('../lib/auth/workspaceSession', () => ({
  useWorkspaceSession: () => ({
    signedIn: false,
    userEmail: null,
    role: null,
    loading: false,
    error: null,
    workspaceId: null,
    workspaceName: null,
    memberships: [],
    setActiveWorkspaceId: vi.fn(),
    refreshSession: vi.fn(),
    signOut: vi.fn(),
  }),
}));

import { signInWithEmailPassword } from '../lib/auth/supabaseAuthSession';

describe('LoginEntry email/password fallback', () => {
  it('renders email sign-in fields when Supabase is configured', () => {
    render(<LoginEntry />);

    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in with email/i })).toBeInTheDocument();
  });

  it('submits email credentials through the auth helper', async () => {
    vi.mocked(signInWithEmailPassword).mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'dev@example.test',
      },
      error: null,
    });

    render(<LoginEntry />);

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'dev@example.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'local-dev-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in with email/i }));

    await waitFor(() => {
      expect(signInWithEmailPassword).toHaveBeenCalledWith(
        'dev@example.test',
        'local-dev-password',
      );
    });
  });

  it('shows auth helper errors instead of failing silently', async () => {
    vi.mocked(signInWithEmailPassword).mockResolvedValue({
      user: null,
      error: 'Invalid login credentials',
    });

    render(<LoginEntry />);

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'dev@example.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in with email/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid login credentials/i)).toBeInTheDocument();
    });
  });
});
