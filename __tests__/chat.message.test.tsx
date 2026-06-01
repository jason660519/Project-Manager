import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../components/chat/ChatMessage';

describe('ChatMessage', () => {
  it('renders user messages', () => {
    render(<ChatMessage message={{ id: 'm1', role: 'user', content: 'hello', createdAt: 1 }} />);
    expect(screen.getByLabelText(/user message/i)).toHaveTextContent('hello');
  });

  it('renders assistant markdown code blocks', () => {
    render(
      <ChatMessage
        message={{
          id: 'm1',
          role: 'assistant',
          content: 'Run:\n\n```bash\nnpm test\n```',
          createdAt: 1,
        }}
      />,
    );
    // With syntax highlighting, text is split into token spans. Use closest approach.
    const pre = document.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre!.textContent).toContain('npm test');
  });

  it('renders assistant provider and model metadata', () => {
    render(
      <ChatMessage
        message={{
          id: 'm1',
          role: 'assistant',
          content: 'hello',
          createdAt: 1,
          provider: 'openai',
          model: 'gpt-4o',
        }}
      />,
    );
    expect(screen.getByLabelText(/assistant message/i)).toHaveTextContent('openai · gpt-4o');
  });
});
