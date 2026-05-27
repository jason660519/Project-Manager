import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TopBar } from '../app/ui/TopBar';
import type { ChatContext } from '../lib/chat/types';
import { I18nProvider } from '../lib/i18n';

const chatContext: ChatContext = {
  currentView: 'dashboard',
  adapters: [],
  activeRunCount: 0,
};

function renderTopBar() {
  return render(
    <I18nProvider>
      <TopBar
        currentView="dashboard"
        activeRunCount={0}
        chatContext={chatContext}
      />
    </I18nProvider>,
  );
}

describe('TopBar AI Assistant popup', () => {
  it('resizes the floating assistant panel and persists the size', async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole('button', { name: /assistant/i }));

    const resizeHandle = screen.getByRole('separator', { name: 'Resize AI Assistant panel' });
    const panel = resizeHandle.parentElement as HTMLElement;
    expect(panel.style.width).toBe('340px');
    expect(panel.style.height).toBe('420px');

    fireEvent.mouseDown(resizeHandle, { clientX: 340, clientY: 420 });
    fireEvent.mouseMove(document, { clientX: 460, clientY: 510 });
    fireEvent.mouseUp(document);

    await waitFor(() => {
      expect(panel.style.width).toBe('460px');
      expect(panel.style.height).toBe('510px');
    });
    expect(window.localStorage.getItem('pm-chat-size')).toBe(
      JSON.stringify({ width: 460, height: 510 }),
    );
  });
});
