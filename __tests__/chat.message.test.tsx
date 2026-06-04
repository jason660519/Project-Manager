import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../components/chat/ChatMessage';
import { I18nProvider } from '../lib/i18n';

function renderChatMessage(message: React.ComponentProps<typeof ChatMessage>['message']) {
  return render(
    <I18nProvider>
      <ChatMessage message={message} />
    </I18nProvider>,
  );
}

describe('ChatMessage', () => {
  it('renders user messages', () => {
    renderChatMessage({ id: 'm1', role: 'user', content: 'hello', createdAt: 1 });
    expect(screen.getByLabelText(/user message/i)).toHaveTextContent('hello');
  });

  it('renders assistant markdown code blocks', () => {
    renderChatMessage({
      id: 'm1',
      role: 'assistant',
      content: 'Run:\n\n```bash\nnpm test\n```',
      createdAt: 1,
    });
    // With syntax highlighting, text is split into token spans. Use closest approach.
    const pre = document.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre!.textContent).toContain('npm test');
  });

  it('renders assistant provider and model metadata', () => {
    renderChatMessage({
      id: 'm1',
      role: 'assistant',
      content: 'hello',
      createdAt: 1,
      provider: 'openai',
      model: 'gpt-4o',
    });
    expect(screen.getByLabelText(/assistant message/i)).toHaveTextContent('openai · gpt-4o');
  });

  it('renders route decision metadata', () => {
    renderChatMessage({
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
    });
    expect(screen.getByLabelText(/assistant message/i)).toHaveTextContent('Route openai · gpt-4o-mini · 2 attempts · 1 cooldown skip');
  });

  it('renders a fallback banner when the route is degraded', () => {
    renderChatMessage({
      id: 'm1',
      role: 'assistant',
      content: 'hello',
      createdAt: 1,
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      routeDecision: {
        routeDecisionId: 'route-2',
        modelAlias: 'pm-reasoning',
        strategy: 'deterministic-fallback-v1',
        selectedProvider: 'anthropic',
        selectedModel: 'claude-sonnet-4-6',
        degraded: true,
        attempts: [
          {
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            status: 'skipped_cooldown',
            errorReason: '429: Your prepayment credits are depleted.',
          },
          { provider: 'anthropic', model: 'claude-sonnet-4-6', status: 'success' },
        ],
      },
    });

    expect(screen.getByRole('status')).toHaveTextContent(/Provider fallback/i);
    expect(screen.getByRole('status')).toHaveTextContent(/gemini · gemini-2\.5-flash skipped \(cooldown\)/i);
    expect(screen.getByRole('status')).toHaveTextContent(/Answered with anthropic · claude-sonnet-4-6/i);
  });
});
