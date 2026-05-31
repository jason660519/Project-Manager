import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvImportModal } from '../app/ui/views/_components/EnvImportModal';

const saveProviderSecretMock = vi.fn();
const revalidateStoredKeyMock = vi.fn();
const scanEnvFilesMock = vi.fn();

vi.mock('../lib/keys/keychain', () => ({
  saveProviderSecret: (provider: unknown, value: string) =>
    saveProviderSecretMock(provider, value),
}));

vi.mock('../lib/keys/validation', () => ({
  revalidateStoredKey: (provider: unknown) => revalidateStoredKeyMock(provider),
}));

vi.mock('../lib/bridge', () => ({
  scanEnvFiles: (root: string) => scanEnvFilesMock(root),
}));

describe('EnvImportModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    saveProviderSecretMock.mockReset();
    revalidateStoredKeyMock.mockReset();
    scanEnvFilesMock.mockReset();
  });

  it('imports detected .env keys and validates them before reporting completion', async () => {
    const onImported = vi.fn();
    revalidateStoredKeyMock.mockResolvedValue({
      ok: true,
      models: ['model-a', 'model-b'],
      errorReason: null,
    });
    render(<EnvImportModal onClose={vi.fn()} onImported={onImported} />);

    await userEvent.type(
      screen.getByPlaceholderText(/Paste \.env content here/),
      `ANTHROPIC_API_KEY=sk-ant-${'a'.repeat(40)}`,
    );
    await userEvent.click(screen.getByRole('button', { name: /Import & validate 1/ }));

    await waitFor(() => expect(onImported).toHaveBeenCalledWith(1));
    expect(saveProviderSecretMock).toHaveBeenCalledTimes(1);
    expect(revalidateStoredKeyMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Validated: ANTHROPIC_API_KEY/)).toBeInTheDocument();
  });

  it('scans the Project Manager root when one is supplied', async () => {
    scanEnvFilesMock.mockResolvedValue([
      {
        path: '/repo/.env',
        name: '.env',
        content: `OPENAI_API_KEY=sk-${'b'.repeat(40)}\nKIMI_API_KEY=sk-${'c'.repeat(40)}`,
      },
    ]);
    render(<EnvImportModal projectRoot="/repo" onClose={vi.fn()} onImported={vi.fn()} />);

    expect(await screen.findByText('OPENAI_API_KEY')).toBeInTheDocument();
    expect(screen.getByText('/repo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rescan \.env/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scan PM root/ })).toBeInTheDocument();
    expect(screen.getByText(/Detected \.env credentials for 2 providers/)).toBeInTheDocument();
    expect(screen.getByText(/Available providers: OpenAI, Kimi \(Moonshot\)/)).toBeInTheDocument();
    expect(scanEnvFilesMock).toHaveBeenCalledWith('/repo');
  });

  it('shows a useful empty Project Manager root scan state with a rescan action', async () => {
    scanEnvFilesMock.mockResolvedValue([]);
    render(<EnvImportModal projectRoot="/empty" onClose={vi.fn()} onImported={vi.fn()} />);

    expect(await screen.findByText('No .env files found in the Project Manager root.')).toBeInTheDocument();
    expect(screen.getByText('/empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rescan \.env/ })).toBeInTheDocument();
    expect(screen.queryByText(/No matching keys detected yet/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Rescan \.env/ }));
    await waitFor(() => expect(scanEnvFilesMock).toHaveBeenCalledTimes(2));
  });

  it('treats a missing Project Manager root as a local startup problem', async () => {
    scanEnvFilesMock.mockRejectedValue(new Error('Project root does not exist: /old-machine/repo'));

    render(
      <EnvImportModal
        projectRoot="/old-machine/repo"
        onClose={vi.fn()}
        onImported={vi.fn()}
      />,
    );

    expect(
      await screen.findByText('The Project Manager root is not available on this machine.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Start Project Manager from its repo folder/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rebind folder/ })).not.toBeInTheDocument();
  });

  it('lets users disable providers from .env detection', async () => {
    render(<EnvImportModal onClose={vi.fn()} onImported={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Providers/ }));
    await userEvent.click(screen.getByLabelText('OpenAI'));
    await userEvent.click(screen.getByRole('button', { name: /Paste \/ drop/ }));
    await userEvent.type(
      screen.getByPlaceholderText(/Paste \.env content here/),
      `OPENAI_API_KEY=sk-${'b'.repeat(40)}\nKIMI_API_KEY=sk-${'c'.repeat(40)}`,
    );

    expect(screen.queryByText('OPENAI_API_KEY')).not.toBeInTheDocument();
    expect(screen.getByText('KIMI_API_KEY')).toBeInTheDocument();
    expect(screen.getByText(/Detected \(1\)/)).toBeInTheDocument();
  });

  it('uses custom env var aliases and default selection preferences', async () => {
    render(<EnvImportModal onClose={vi.fn()} onImported={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Providers/ }));
    await userEvent.clear(screen.getByLabelText('OpenAI env names'));
    await userEvent.type(screen.getByLabelText('OpenAI env names'), 'MY_OPENAI_KEY');
    await userEvent.click(screen.getByLabelText('OpenAI selected by default'));
    await userEvent.click(screen.getByRole('button', { name: /Paste \/ drop/ }));
    await userEvent.type(
      screen.getByPlaceholderText(/Paste \.env content here/),
      `MY_OPENAI_KEY=sk-${'b'.repeat(40)}`,
    );

    expect(screen.getByText('MY_OPENAI_KEY')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /OpenAI/ })).not.toBeChecked();
    expect(screen.getByText('0 of 1 selected')).toBeInTheDocument();
  });
});
