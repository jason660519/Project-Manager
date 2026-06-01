import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock localStorage
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
  get length() { return Object.keys(localStorageStore).length; },
  key: vi.fn((_index: number) => ''),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock chatAgent so CP never hits the real AI API
const mockSendChatMessage = vi.fn();
vi.mock('../lib/chat/chatAgent', () => ({
  sendChatMessage: mockSendChatMessage,
}));

import { I18nProvider } from '../lib/i18n/context';
import { ChatPageClient } from '../app/chat/ChatPageClient';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe('ChatPageClient', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    mockSendChatMessage.mockResolvedValue({
      content: 'Hello! I am the assistant. How can I help you?',
      handledLocally: false,
    });
    // Ensure clipboard mock
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    // Mock scrollIntoView for jsdom
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders the empty state with quick command buttons', () => {
    renderWithI18n(<ChatPageClient />);
    expect(screen.getByText('Project Manager Assistant')).toBeInTheDocument();
    expect(screen.getByText('/status')).toBeInTheDocument();
    expect(screen.getByText('/help')).toBeInTheDocument();
    expect(screen.getByText('/go dashboard')).toBeInTheDocument();
  });

  it('shows history sidebar with New button', () => {
    renderWithI18n(<ChatPageClient />);
    expect(screen.getAllByText('History').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows AI Assistant title in header', () => {
    renderWithI18n(<ChatPageClient />);
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('shows empty history message when no sessions exist', () => {
    renderWithI18n(<ChatPageClient />);
    expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument();
  });

  it('renders ChatInput with placeholder', () => {
    renderWithI18n(<ChatPageClient />);
    expect(screen.getByPlaceholderText('Ask me anything...')).toBeInTheDocument();
  });

  it('persists session to localStorage after sending a message', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ChatPageClient />);

    const textarea = screen.getByPlaceholderText('Ask me anything...');
    await user.type(textarea, 'Hello!');
    await user.keyboard('{Enter}');

    // Wait for the mock async sendChatMessage to resolve
    await new Promise((r) => setTimeout(r, 100));

    expect(localStorageMock.setItem).toHaveBeenCalled();
    const setCall = localStorageMock.setItem.mock.calls.find(
      ([key]) => key === 'projectManager:chat-sessions',
    );
    expect(setCall).toBeTruthy();
    if (!setCall) throw new Error('Expected chat sessions to be saved');
    const stored = JSON.parse(setCall[1]);
    expect(stored.length).toBeGreaterThanOrEqual(1);
    expect(stored[0].messages[0].content).toBe('Hello!');
  });

  it('shows AI response when no project context is provided', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ChatPageClient />);

    const textarea = screen.getByPlaceholderText('Ask me anything...');
    await user.type(textarea, 'Hello!');
    await user.keyboard('{Enter}');

    // Wait for the mock async sendChatMessage to resolve
    await new Promise((r) => setTimeout(r, 100));

    // Without project context, chatAgent falls through to the AI chat API
    expect(screen.getByText(/I am the assistant/i)).toBeInTheDocument();
  });

  it('lets the console chat pick a validated provider model before sending', async () => {
    const user = userEvent.setup();
    localStorageMock.setItem(
      'pm:keys-metadata',
      JSON.stringify({
        openai: {
          lastValidatedAt: '2026-05-28T00:00:00.000Z',
          status: 'ok',
          dynamicModels: ['gpt-live-a', 'gpt-live-b'],
        },
      }),
    );
    renderWithI18n(<ChatPageClient />);

    await user.click(screen.getAllByRole('button', { name: /chat settings/i })[0]);
    await user.selectOptions(screen.getByLabelText(/provider/i), 'openai');

    const modelInput = screen.getByLabelText(/model id/i);
    expect(modelInput).toHaveValue('gpt-4o');
    await user.clear(modelInput);
    await user.type(modelInput, 'gpt-custom-2026');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    const textarea = screen.getByPlaceholderText('Ask me anything...');
    await user.type(textarea, 'Hello with model');
    await user.keyboard('{Enter}');

    await new Promise((r) => setTimeout(r, 100));
    expect(mockSendChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Hello with model',
      chatSettings: expect.objectContaining({
        provider: 'openai',
        model: 'gpt-custom-2026',
      }),
    }));
  });

  it('deletes a session from history', async () => {
    // Seed a session
    const sessionId = 'test-session-abc';
    const sessions = [{ id: sessionId, title: 'Test Chat', messages: [{ id: 'm1', role: 'user' as const, content: 'hi', createdAt: Date.now() }], createdAt: Date.now() }];
    localStorageMock.setItem('projectManager:chat-sessions', JSON.stringify(sessions));

    const user = userEvent.setup();
    renderWithI18n(<ChatPageClient />);

    // Should show the session
    expect(screen.getByText('Test Chat')).toBeInTheDocument();

    // Find and click the delete button
    const deleteButtons = screen.getAllByRole('button', { name: /delete session/i });
    await user.click(deleteButtons[0]);

    // After deletion, should show empty message again
    expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument();
  });

  it('filters saved sessions by title and message content', async () => {
    const sessions = [
      {
        id: 'alpha',
        title: 'Architecture Notes',
        messages: [{ id: 'm1', role: 'user' as const, content: 'ADR boundary', createdAt: Date.now() }],
        createdAt: Date.now(),
      },
      {
        id: 'beta',
        title: 'Release Chat',
        messages: [{ id: 'm2', role: 'assistant' as const, content: 'provider metadata', createdAt: Date.now(), provider: 'openai', model: 'gpt-4o' }],
        createdAt: Date.now() - 1000,
        tags: ['release'],
      },
    ];
    localStorageMock.setItem('projectManager:chat-sessions', JSON.stringify(sessions));

    const user = userEvent.setup();
    renderWithI18n(<ChatPageClient />);

    await user.type(screen.getByLabelText(/search sessions/i), 'metadata');

    expect(screen.queryByText('Architecture Notes')).not.toBeInTheDocument();
    expect(screen.getByText('Release Chat')).toBeInTheDocument();
  });

  it('filters saved sessions by time range', async () => {
    const now = Date.now();
    const sessions = [
      {
        id: 'recent',
        title: 'Recent Chat',
        messages: [{ id: 'm1', role: 'user' as const, content: 'fresh', createdAt: now }],
        createdAt: now,
      },
      {
        id: 'old',
        title: 'Old Chat',
        messages: [{ id: 'm2', role: 'user' as const, content: 'stale', createdAt: now - 40 * 24 * 60 * 60 * 1000 }],
        createdAt: now - 40 * 24 * 60 * 60 * 1000,
      },
    ];
    localStorageMock.setItem('projectManager:chat-sessions', JSON.stringify(sessions));

    const user = userEvent.setup();
    renderWithI18n(<ChatPageClient />);

    await user.click(screen.getByRole('button', { name: '30d' }));

    expect(screen.getByText('Recent Chat')).toBeInTheDocument();
    expect(screen.queryByText('Old Chat')).not.toBeInTheDocument();
  });

  it('edits saved session tags and makes them searchable', async () => {
    const sessions = [{
      id: 'tagged',
      title: 'Taggable Chat',
      messages: [{ id: 'm1', role: 'user' as const, content: 'hello', createdAt: Date.now() }],
      createdAt: Date.now(),
    }];
    localStorageMock.setItem('projectManager:chat-sessions', JSON.stringify(sessions));

    const user = userEvent.setup();
    renderWithI18n(<ChatPageClient />);

    await user.click(screen.getByRole('button', { name: /edit session tags/i }));
    await user.type(screen.getByPlaceholderText('tag-a, tag-b'), 'security, runtime');
    await user.click(screen.getByRole('button', { name: /save tags/i }));

    const stored = JSON.parse(localStorageMock.getItem('projectManager:chat-sessions') ?? '[]');
    expect(stored[0].tags).toEqual(['security', 'runtime']);

    await user.type(screen.getByLabelText(/search sessions/i), 'runtime');
    expect(screen.getByText('Taggable Chat')).toBeInTheDocument();
  });
});
