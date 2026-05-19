import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import type { ChatContext } from '../lib/chat/types';
import { ChatPanel } from '../components/chat/ChatPanel';
import { sendChatMessage } from '../lib/chat/chatAgent';

vi.mock('../lib/chat/chatAgent', () => ({
  sendChatMessage: vi.fn(),
}));

const sendChatMessageMock = vi.mocked(sendChatMessage);

const mockContext: ChatContext = {
  currentView: 'dashboard',
  selectedProject: {
    id: 'project-manager',
    configPath: '/tmp/config.json',
    config: {
      schemaVersion: 5,
      id: 'project-manager',
      project: { name: 'Project Manager', root: '/tmp/project-manager', defaultIDE: 'Cursor' },
      features: [],
      adapters: { ides: [], agents: [] },
    },
  },
  adapters: [],
  activeRunCount: 0,
};

function renderPanel(defaultExpanded = false) {
  return render(
    <I18nProvider>
      <ChatPanel context={mockContext} defaultExpanded={defaultExpanded} />
    </I18nProvider>,
  );
}

describe('ChatPanel', () => {
  beforeEach(() => {
    sendChatMessageMock.mockReset();
  });

  it('renders toggle button when collapsed', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ask me anything/i)).not.toBeInTheDocument();
  });

  it('renders message input when expanded', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: /ai assistant/i }));
    expect(screen.getByPlaceholderText(/ask me anything/i)).toBeInTheDocument();
  });

  it('shows empty state with welcome message', () => {
    renderPanel(true);
    expect(screen.getByText(/project manager assistant/i)).toBeInTheDocument();
  });

  it('typing in input and pressing Enter sends a message', async () => {
    sendChatMessageMock.mockResolvedValueOnce({ content: 'Here is the status.' });
    renderPanel(true);

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: '  status please  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(sendChatMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      content: 'status please',
      context: mockContext,
    }));
    expect(screen.getByText('status please')).toBeInTheDocument();
    expect(await screen.findByText('Here is the status.')).toBeInTheDocument();
  });

  it('empty input does not send', async () => {
    renderPanel(true);
    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(sendChatMessageMock).not.toHaveBeenCalled();
  });

  it('send button is disabled while loading', async () => {
    const user = userEvent.setup();
    let resolveResponse!: (value: { content: string }) => void;
    sendChatMessageMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveResponse = resolve;
    }));
    renderPanel(true);

    fireEvent.change(screen.getByPlaceholderText(/ask me anything/i), { target: { value: 'status' } });
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByRole('button', { name: /thinking/i })).toBeDisabled();
    resolveResponse({ content: 'Done' });
    await screen.findByText('Done');
  });

  it('messages persist across collapse and expand', async () => {
    const user = userEvent.setup();
    sendChatMessageMock.mockResolvedValueOnce({ content: 'Persisted response' });
    renderPanel(true);

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('Persisted response')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /collapse chat/i }));
    expect(screen.queryByPlaceholderText(/ask me anything/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ai assistant/i }));
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('Persisted response')).toBeInTheDocument();
  });

  it('shows localized error when agent call rejects', async () => {
    sendChatMessageMock.mockRejectedValueOnce(new Error('boom'));
    renderPanel(true);
    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'fail' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});
