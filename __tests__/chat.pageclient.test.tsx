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

// Mock chatAgent to avoid actually calling it
vi.mock('../../lib/chat/chatAgent', () => ({
  sendChatMessage: vi.fn().mockResolvedValue({
    content: 'Hello! I am the assistant. How can I help you?',
    handledLocally: false,
  }),
}));

import { ChatPageClient } from '../app/chat/ChatPageClient';

describe('ChatPageClient', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Ensure clipboard mock
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it('renders the empty state with quick command buttons', () => {
    render(<ChatPageClient />);
    expect(screen.getByText('Project Manager Assistant')).toBeInTheDocument();
    // /status appears in both description text and as a button — use getAllByText
    const statusElements = screen.getAllByText('/status');
    expect(statusElements.length).toBeGreaterThanOrEqual(2);
    const helpElements = screen.getAllByText('/help');
    expect(helpElements.length).toBeGreaterThanOrEqual(2);
    const dashboardElements = screen.getAllByText('/go dashboard');
    expect(dashboardElements.length).toBeGreaterThanOrEqual(2);
  });

  it('shows history sidebar with New button', () => {
    render(<ChatPageClient />);
    // History appears in both the H2 heading and mobile toggle
    const historyElements = screen.getAllByText('History');
    expect(historyElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows AI Assistant title in header', () => {
    render(<ChatPageClient />);
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('shows empty history message when no sessions exist', () => {
    render(<ChatPageClient />);
    expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument();
  });

  it('renders ChatInput with placeholder', () => {
    render(<ChatPageClient />);
    expect(screen.getByPlaceholderText('Ask me anything...')).toBeInTheDocument();
  });

  it('persists session to localStorage after sending a message', async () => {
    const user = userEvent.setup();
    render(<ChatPageClient />);

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

  it('shows error response when no project context is provided', async () => {
    const user = userEvent.setup();
    render(<ChatPageClient />);

    const textarea = screen.getByPlaceholderText('Ask me anything...');
    await user.type(textarea, 'Hello!');
    await user.keyboard('{Enter}');

    // Wait for the mock async sendChatMessage to resolve
    await new Promise((r) => setTimeout(r, 100));

    // Without project context, chatAgent returns error
    expect(screen.getByText(/Select a project first/i)).toBeInTheDocument();
  });

  it('deletes a session from history', async () => {
    // Seed a session
    const sessionId = 'test-session-abc';
    const sessions = [{ id: sessionId, title: 'Test Chat', messages: [{ id: 'm1', role: 'user' as const, content: 'hi', createdAt: Date.now() }], createdAt: Date.now() }];
    localStorageMock.setItem('projectManager:chat-sessions', JSON.stringify(sessions));

    const user = userEvent.setup();
    render(<ChatPageClient />);

    // Should show the session
    expect(screen.getByText('Test Chat')).toBeInTheDocument();

    // Find and click the delete button
    const deleteButtons = screen.getAllByRole('button', { name: /delete session/i });
    await user.click(deleteButtons[0]);

    // After deletion, should show empty message again
    expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument();
  });
});
