import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatInput } from '../components/chat/ChatInput';

describe('ChatInput', () => {
  it('sends on Enter', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput placeholder="Ask" sendLabel="Send" loadingLabel="Thinking" loading={false} onSend={onSend} />);
    await user.type(screen.getByPlaceholderText('Ask'), 'hello{Enter}');
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('does not send whitespace', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput placeholder="Ask" sendLabel="Send" loadingLabel="Thinking" loading={false} onSend={onSend} />);
    await user.type(screen.getByPlaceholderText('Ask'), '   {Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables send while loading', () => {
    render(<ChatInput placeholder="Ask" sendLabel="Send" loadingLabel="Thinking" loading onSend={vi.fn()} />);
    expect(screen.getByRole('button', { name: /thinking/i })).toBeDisabled();
  });
});
