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

  it('renders route decision metadata', () => {
    render(
      <ChatMessage
        message={{
          id: 'm1',
          role: 'assistant',
          content: 'hello',
          createdAt: 1,
          routeDecision: {
            routeDecisionId: 'route-1',
            modelAlias: 'pm-code',
            taskClass: 'chat',
            strategy: 'ordered_fallback',
            selectedProvider: 'openai',
            selectedModel: 'gpt-4o-mini',
            degraded: false,
            attempts: [
              { provider: 'anthropic', model: 'claude', status: 'skipped_cooldown', errorReason: 'cooldown' },
              { provider: 'openai', model: 'gpt-4o-mini', status: 'success' },
            ],
          },
        }}
      />,
    );
    expect(screen.getByLabelText(/assistant message/i)).toHaveTextContent('Route openai · gpt-4o-mini · 2 attempts · 1 cooldown skip');
  });
});
