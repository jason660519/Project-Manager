import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { AiSdksView } from '../app/ui/views/AiSdksView';
import { I18nProvider } from '../lib/i18n';
import { en } from '../lib/i18n/en';

describe('AiSdksView', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders a header Rescan all control', async () => {
    render(
      <I18nProvider>
        <AiSdksView />
      </I18nProvider>,
    );

    expect(await screen.findByRole('button', { name: en.aiSdks.controls.rescanAll })).toBeInTheDocument();
  }, 20000);
});
