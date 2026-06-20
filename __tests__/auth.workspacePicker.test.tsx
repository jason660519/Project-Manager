import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspacePicker } from '../app/auth/WorkspacePicker';

describe('WorkspacePicker', () => {
  it('renders nothing when only one membership exists', () => {
    const { container } = render(
      <WorkspacePicker
        memberships={[
          {
            workspaceId: 'workspace-1',
            workspaceName: 'Portal Workspace',
            role: 'viewer',
          },
        ]}
        activeWorkspaceId="workspace-1"
        onSelect={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('lets the user switch active workspaces', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <WorkspacePicker
        memberships={[
          {
            workspaceId: 'workspace-1',
            workspaceName: 'Portal Workspace',
            role: 'viewer',
          },
          {
            workspaceId: 'workspace-2',
            workspaceName: 'Engineering Workspace',
            role: 'developer',
          },
        ]}
        activeWorkspaceId="workspace-1"
        onSelect={onSelect}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox'), 'workspace-2');
    expect(onSelect).toHaveBeenCalledWith('workspace-2');
  });
});
