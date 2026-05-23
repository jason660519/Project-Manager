import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompanyStandardsView } from '../app/ui/views/CompanyStandardsView';

vi.mock('../lib/bridge', () => ({
  openPath: vi.fn(),
}));

describe('CompanyStandardsView', () => {
  it('renders the layered company standards hub', () => {
    render(<CompanyStandardsView />);

    expect(screen.getByRole('heading', { name: 'Company Standards Hub' })).toBeInTheDocument();
    expect(screen.getByText('Separate Common Standards From App Profiles')).toBeInTheDocument();
    expect(screen.getByText('Foundations')).toBeInTheDocument();
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('Patterns')).toBeInTheDocument();
    expect(screen.getByText('App Profiles')).toBeInTheDocument();
    expect(screen.getByText('Package Only What Has Stabilized')).toBeInTheDocument();
    expect(screen.getByText('@company-ai/standards-manifest')).toBeInTheDocument();
    expect(screen.getByText('Open Standards Sources')).toBeInTheDocument();
  });
});
