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
      ([key]: [string]) => key === 'projectManager:chat-sessions',
    );
    expect(setCall).toBeTruthy();
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
});
