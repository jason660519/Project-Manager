import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      schemaVersion: 6,
      id: 'project-manager',
      project: { name: 'Project Manager', root: '/tmp/project-manager', defaultIDE: 'Cursor' },
      features: [],
      adapters: { ides: [], agents: [] },
    },
  },
  adapters: [],
  activeRunCount: 0,
};

function renderPanel(defaultExpanded = false, docked = false) {
  return render(
    <I18nProvider>
      <ChatPanel context={mockContext} defaultExpanded={defaultExpanded} docked={docked} />
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

  it('keeps docked conversations inside a scroll container', () => {
    const { container } = renderPanel(true, true);
    const panel = container.firstElementChild;
    const scrollRegion = screen.getByTestId('chat-message-scroll');

    expect(panel).toHaveClass('min-h-0', 'overflow-hidden');
    expect(scrollRegion).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(screen.getByPlaceholderText(/ask me anything/i).closest('.shrink-0')).toBeTruthy();
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

  it('lets the docked assistant pick a validated provider model or enter a custom model id', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'pm:keys-metadata',
      JSON.stringify({
        anthropic: {
          lastValidatedAt: '2026-05-28T00:00:00.000Z',
          status: 'ok',
          dynamicModels: ['claude-live-a', 'claude-live-b'],
        },
      }),
    );
    sendChatMessageMock.mockResolvedValueOnce({ content: 'Using selected model.' });
    renderPanel(true, true);

    await user.click(screen.getByRole('button', { name: /chat settings/i }));
    await user.selectOptions(screen.getByLabelText(/provider/i), 'anthropic');

    const modelInput = screen.getByLabelText(/model id/i);
    expect(modelInput).toHaveValue('claude-sonnet-4-6');
    expect(screen.getByText(/model suggestions from the curated catalogue and latest model refresh/i)).toBeInTheDocument();

    await user.clear(modelInput);
    await user.type(modelInput, 'claude-custom-999');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    const input = screen.getByPlaceholderText(/ask me anything/i);
    await user.type(input, 'use this provider');
    await user.keyboard('{Enter}');

    expect(sendChatMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      content: 'use this provider',
      chatSettings: expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-custom-999',
      }),
    }));
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
    // The send button is the last button (after file attach)
    const buttons = screen.getAllByRole('button');
    const sendBtn = buttons[buttons.length - 1];
    await user.click(sendBtn!);

    // Only the send button should be disabled while loading
    expect(sendBtn).toBeDisabled();
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

  it('does not render Xmux selected element payloads as conversation cards', async () => {
    renderPanel(true, true);
    const input = screen.getByPlaceholderText(/ask me anything/i) as HTMLTextAreaElement;

    act(() => {
      window.dispatchEvent(
        new CustomEvent('pm:xmux-selected-element', {
          detail: {
            positionTag: 'bottom',
            elementTag: 'button',
            selector: 'body > button',
            url: 'https://example.com',
            domTree: {
              tag: 'button',
              attributes: { type: 'button' },
              children: [{ tag: 'span', text: 'Sign in', children: [] }],
            },
            outerHTML: '<button type="button"><span>Sign in</span></button>',
          },
        }),
      );
    });

    await waitFor(() => {
      expect(input.value).toContain('[xmux element: bottom · button]');
    });
    expect(screen.getByTestId('chat-message-scroll').textContent).not.toContain('bottom');
    expect(screen.getByTestId('chat-message-scroll').textContent).not.toContain('"tag": "span"');
    expect(screen.getByTestId('chat-message-scroll').textContent).not.toContain('outerHTML');
  });

  it('appends Xmux selected element context to the end of the chat input', async () => {
    renderPanel(true, true);
    const input = screen.getByPlaceholderText(/ask me anything/i) as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: 'Please review this layout' } });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('pm:xmux-selected-element', {
          detail: {
            positionTag: 'bottom',
            elementTag: 'button',
            selector: 'body > button',
            url: 'https://example.com',
            domTree: { tag: 'button' },
            outerHTML: '<button>Go</button>',
          },
        }),
      );
    });

    await waitFor(() => {
      expect(input.value.startsWith('Please review this layout')).toBe(true);
      expect(input.value).toContain('[xmux element: bottom · button]');
      expect(input.value).toContain('selector: body > button');
      expect(input.value).toContain('<button>Go</button>');
      expect(input.value.indexOf('Please review this layout')).toBeLessThan(
        input.value.indexOf('[xmux element: bottom · button]'),
      );
      expect(input.selectionStart).toBe(input.value.length);
      expect(input.selectionEnd).toBe(input.value.length);
    });
  });

  it('fills the chat input with selected element context when empty', async () => {
    renderPanel(true, true);
    const input = screen.getByPlaceholderText(/ask me anything/i) as HTMLTextAreaElement;

    act(() => {
      window.dispatchEvent(
        new CustomEvent('pm:xmux-selected-element', {
          detail: {
            positionTag: 'top',
            elementTag: 'header',
            selector: 'body > header',
          },
        }),
      );
    });

    await waitFor(() => {
      expect(input.value).toContain('[xmux element: top · header]');
      expect(input.value).toContain('selector: body > header');
    });
  });

  it('treats whitespace-only chat input as blank before appending Xmux context', async () => {
    renderPanel(true, true);
    const input = screen.getByPlaceholderText(/ask me anything/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: ' \n\t' } });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('pm:xmux-selected-element', {
          detail: {
            positionTag: 'top',
            elementTag: 'header',
            selector: 'body > header',
          },
        }),
      );
    });

    await waitFor(() => {
      expect(input.value.startsWith('[xmux element: top · header]')).toBe(true);
      expect(input.value.startsWith(' \n\t')).toBe(false);
    });
  });

  it('ignores empty Xmux selected element payloads', async () => {
    renderPanel(true, true);
    const input = screen.getByPlaceholderText(/ask me anything/i) as HTMLTextAreaElement;

    act(() => {
      window.dispatchEvent(
        new CustomEvent('pm:xmux-selected-element', {
          detail: {},
        }),
      );
    });

    await waitFor(() => {
      expect(input.value).toBe('');
    });
    expect(screen.getByTestId('chat-message-scroll').textContent).not.toContain('selected');
    expect(screen.getByTestId('chat-message-scroll').textContent).not.toContain('element');
  });
});
