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
    expect(screen.getByText('npm test').closest('code')).toBeInTheDocument();
    expect(screen.getByText('npm test').closest('pre')).toBeInTheDocument();
  });
});
