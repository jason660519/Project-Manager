import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatInput } from '../components/chat/ChatInput';
import { XMUX_SELECTED_ELEMENT_MIME } from '../lib/xmux/selectedElementSnippet';

describe('ChatInput', () => {
  it('sends on Enter', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput placeholder="Ask" sendLabel="Send" loadingLabel="Thinking" loading={false} onSend={onSend} />);
    await user.type(screen.getByPlaceholderText('Ask'), 'hello{Enter}');
    expect(onSend).toHaveBeenCalledWith('hello', undefined);
  });

  it('does not send while an IME composition is active or immediately after candidate confirmation', () => {
    vi.useFakeTimers();
    const onSend = vi.fn();
    render(<ChatInput placeholder="Ask" sendLabel="Send" loadingLabel="Thinking" loading={false} onSend={onSend} />);
    const input = screen.getByPlaceholderText('Ask');

    fireEvent.change(input, { target: { value: '測' } });
    fireEvent.compositionStart(input);
    fireEvent.compositionUpdate(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(31);
    });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('測', undefined);
    vi.useRealTimers();
  });

  it('does not submit Enter events marked as IME composition by the browser', () => {
    const onSend = vi.fn();
    render(<ChatInput placeholder="Ask" sendLabel="Send" loadingLabel="Thinking" loading={false} onSend={onSend} />);
    const input = screen.getByPlaceholderText('Ask');

    fireEvent.change(input, { target: { value: '中' } });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, which: 229 });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('preserves Shift+Enter as a non-submit input shortcut', () => {
    const onSend = vi.fn();
    render(<ChatInput placeholder="Ask" sendLabel="Send" loadingLabel="Thinking" loading={false} onSend={onSend} />);
    const input = screen.getByPlaceholderText('Ask');

    fireEvent.change(input, { target: { value: 'line one' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
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
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(1);
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });

  it('drops Xmux selected element context at the end of existing input', () => {
    render(<ChatInput placeholder="Ask" sendLabel="Send" loadingLabel="Thinking" loading={false} onSend={vi.fn()} />);
    const input = screen.getByPlaceholderText('Ask') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'first line\nsecond line' } });
    input.setSelectionRange(3, 3);

    fireEvent.drop(input, {
      dataTransfer: {
        getData: (type: string) =>
          type === XMUX_SELECTED_ELEMENT_MIME ? '[xmux element: bottom · button]' : '',
      },
    });

    expect(input.value).toBe('first line\nsecond line\n\n[xmux element: bottom · button]');
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('replaces whitespace-only draft content when dropping Xmux selected element context', () => {
    render(<ChatInput placeholder="Ask" sendLabel="Send" loadingLabel="Thinking" loading={false} onSend={vi.fn()} />);
    const input = screen.getByPlaceholderText('Ask') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '  \n' } });

    fireEvent.drop(input, {
      dataTransfer: {
        getData: (type: string) =>
          type === XMUX_SELECTED_ELEMENT_MIME ? '[xmux element: top · header]' : '',
      },
    });

    expect(input.value).toBe('[xmux element: top · header]');
  });
});
