import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAssistantsConsoleClient } from '../app/ai_assistants/AIAssistantsConsoleClient';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach((key) => delete localStorageStore[key]); }),
  get length() { return Object.keys(localStorageStore).length; },
  key: vi.fn((_index: number) => ''),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('AIAssistantsConsoleClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders the control console tabs and overview metrics', () => {
    render(<AIAssistantsConsoleClient activeSheet="overview" />);

    expect(screen.getByText('AI Assistants Control Console')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Instance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Permissions/i })).toBeInTheDocument();
    expect(screen.getByText('Operational Boundaries')).toBeInTheDocument();
  });

  it('validates instance URLs and shows production URL warnings', async () => {
    const user = userEvent.setup();
    render(<AIAssistantsConsoleClient activeSheet="instances" />);

    const gatewayInput = screen.getByLabelText(/Gateway Access/i);
    await user.clear(gatewayInput);
    await user.type(gatewayInput, 'ftp://example.test');
    await user.click(screen.getByRole('button', { name: 'Validate' }));

    expect(screen.getByText(/Gateway Access must use https/i)).toBeInTheDocument();
  });

  it('records audit history when a high-risk skill is enabled', async () => {
    const user = userEvent.setup();
    render(<AIAssistantsConsoleClient activeSheet="skills" />);

    await user.click(screen.getAllByRole('button', { name: 'Enable' })[0]);
    await user.click(screen.getByRole('button', { name: /Audit/i }));

    expect(push).toHaveBeenCalledWith('/ai_assistants/audit');
  });

  it('updates permission state from the permissions sheet', async () => {
    const user = userEvent.setup();
    render(<AIAssistantsConsoleClient activeSheet="permissions" />);

    const commandPermission = screen.getByText('tool:run_command');
    expect(commandPermission).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[3], 'guarded');

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'projectManager:ai-assistants-console:v1',
      expect.stringContaining('"scope":"tool:run_command"'),
    );
  });
});
