import { act, render, screen, type RenderResult } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';

vi.mock('next/dynamic', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: (
      loader: () => Promise<React.ComponentType<Record<string, unknown>>>,
      options?: { loading?: React.ComponentType<Record<string, unknown>> },
    ) => {
      function DynamicRouteView(props: Record<string, unknown>) {
        const [Component, setComponent] =
          ReactActual.useState<React.ComponentType<Record<string, unknown>> | null>(null);

        ReactActual.useEffect(() => {
          let mounted = true;
          void loader().then((Loaded) => {
            if (mounted) setComponent(() => Loaded);
          });
          return () => {
            mounted = false;
          };
        }, []);

        if (!Component) {
          const Loading = options?.loading;
          return Loading ? <Loading /> : null;
        }
        return <Component {...props} />;
      }

      return DynamicRouteView;
    },
  };
});

vi.mock('../app/ui/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../app/ui/views/XmuxView', () => ({
  XmuxView: ({
    projects,
    selectedDashboardProjectIds,
    selectedProjectId,
  }: {
    projects?: unknown[];
    selectedDashboardProjectIds?: string[];
    selectedProjectId?: string;
  }) => (
    <div
      data-testid="xmux-view"
      data-project-count={projects?.length ?? 0}
      data-selected-dashboard-projects={(selectedDashboardProjectIds ?? []).join(',')}
      data-selected-project={selectedProjectId ?? ''}
    />
  ),
}));

vi.mock('../app/ui/views/KeysView', () => ({
  KeysView: ({ projectRoot, initialSheet }: { projectRoot?: string; initialSheet?: string }) => (
    <div
      data-testid="keys-view"
      data-project-root={projectRoot ?? ''}
      data-initial-sheet={initialSheet ?? ''}
    />
  ),
}));

vi.mock('../app/ui/views/DocumentationView', () => ({
  DocumentationView: ({ manifest, initialSlug }: { manifest: unknown; initialSlug?: string[] }) => (
    <div
      data-testid="documentation-view"
      data-has-manifest={manifest ? 'true' : 'false'}
      data-initial-slug={(initialSlug ?? []).join('/')}
    />
  ),
}));

vi.mock('../app/ai_assistants/AIAssistantsConsoleClient', () => ({
  AIAssistantsConsoleClient: ({
    activeSheet,
    projectRoot,
    engineersPanel,
  }: {
    activeSheet?: string;
    projectRoot?: string;
    engineersPanel?: React.ReactNode;
  }) => (
    <div data-testid="ai-assistants-view" data-active-sheet={activeSheet ?? ''} data-project-root={projectRoot ?? ''}>
      {engineersPanel ? <span data-testid="engineers-panel-prop" /> : null}
    </div>
  ),
}));

vi.mock('../app/chat/ChatPageClient', () => ({
  ChatPageClient: () => <div data-testid="chat-view" />,
}));

vi.mock('../app/ui/views/EngineersView', () => ({
  EngineersView: () => <div data-testid="engineers-view" />,
}));

vi.mock('../lib/adapters/registry', () => ({
  listAdapters: () => [],
  listAdapterDescriptors: () => [],
}));

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/bridge')>();
  return {
    ...actual,
    getProjectManagerRoot: vi.fn(async () => '/Users/jasonmacbbookpro/Project/Project-Manager'),
  };
});

const { MainClient } = await import('../app/ui/MainClient');

function renderMainClient(
  ui: React.ReactElement,
  options?: Parameters<typeof render>[1],
): RenderResult {
  return render(<I18nProvider>{ui}</I18nProvider>, options);
}

async function flushRouteView() {
  await act(async () => {});
}

describe('MainClient lazy route views', () => {
  it('shows a compact loading state before the xmux route chunk resolves', async () => {
    renderMainClient(<MainClient currentView="xmux" />);

    expect(screen.getByText('Loading view...')).toBeInTheDocument();

    await flushRouteView();
    expect(await screen.findByTestId('xmux-view')).toBeInTheDocument();
  });

  it('passes keys deep-link sheet props through the lazy boundary', async () => {
    renderMainClient(<MainClient currentView="keys" keysSheet="llm-arena" />);
    await flushRouteView();

    expect(await screen.findByTestId('keys-view')).toHaveAttribute(
      'data-initial-sheet',
      'llm-arena',
    );
  });

  it('passes documentation manifest and slug through the lazy boundary', async () => {
    renderMainClient(
      <MainClient
        currentView="documentation"
        documentationSlug={['guides', 'features', 'xmux']}
      />,
    );
    await flushRouteView();

    const docs = await screen.findByTestId('documentation-view');
    expect(docs).toHaveAttribute('data-has-manifest', 'true');
    expect(docs).toHaveAttribute('data-initial-slug', 'guides/features/xmux');
  });

  it('preserves AI Assistants sheet selection through the lazy boundary', async () => {
    renderMainClient(<MainClient currentView="chat" assistantSheet="engineers" />);
    await flushRouteView();

    expect(await screen.findByTestId('ai-assistants-view')).toHaveAttribute(
      'data-active-sheet',
      'engineers',
    );
  });

  it('passes the detected Project Manager root to AI Assistants workflow runs', async () => {
    renderMainClient(<MainClient currentView="chat" assistantSheet="workflow-runs" />);
    await flushRouteView();

    expect(await screen.findByTestId('ai-assistants-view')).toHaveAttribute(
      'data-project-root',
      '/Users/jasonmacbbookpro/Project/Project-Manager',
    );
  });
});
