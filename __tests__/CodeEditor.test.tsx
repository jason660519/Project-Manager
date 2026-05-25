import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CodeEditor } from '../components/CodeEditor';

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  openInEditor: vi.fn(),
  setModelMarkers: vi.fn(),
  quickCommandRun: vi.fn(),
  findRun: vi.fn(),
  outlineRun: vi.fn(),
  lastEditorProps: [] as any[],
  lastDiffProps: [] as any[],
}));

vi.mock('../lib/bridge', () => ({
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  openInEditor: mocks.openInEditor,
}));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    t: {
      codeEditor: {
        title: 'Code Editor',
        save: 'Save',
        saved: 'Saved',
        loading: 'Loading...',
        loadingEditor: 'Loading editor...',
        openInEditor: 'Open in Editor',
        expand: 'Expand',
        collapse: 'Collapse',
        close: 'Close',
        saveShortcut: 'Save (⌘S)',
        readError: 'Unable to read file',
        poweredBy: 'Powered by',
        languageLabel: 'Language',
      },
    },
  }),
}));

vi.mock('@monaco-editor/react', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const editorStub = {
    addAction: vi.fn(),
    getAction: (id: string) => {
      if (id === 'editor.action.quickCommand') return { run: mocks.quickCommandRun };
      if (id === 'actions.find') return { run: mocks.findRun };
      if (id === 'editor.action.quickOutline') return { run: mocks.outlineRun };
      return { run: vi.fn() };
    },
    getModel: () => ({}),
    getPosition: () => ({ lineNumber: 4, column: 2 }),
    onDidChangeCursorPosition: vi.fn(),
    revealLineInCenter: vi.fn(),
    setPosition: vi.fn(),
  };
  const monacoStub = {
    editor: {
      defineTheme: vi.fn(),
      setTheme: vi.fn(),
      setModelMarkers: mocks.setModelMarkers,
    },
    MarkerSeverity: { Error: 8 },
    KeyMod: { CtrlCmd: 2048, Shift: 1024 },
    KeyCode: { KeyS: 49, KeyG: 35, KeyD: 32 },
  };

  return {
    default: (props: any) => {
      mocks.lastEditorProps.push(props);
      React.useEffect(() => {
        props.onMount?.(editorStub, monacoStub);
        props.onValidate?.([]);
      }, []);
      return React.createElement('textarea', {
        'aria-label': 'mock monaco editor',
        value: props.value ?? '',
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange?.(event.target.value),
      });
    },
    DiffEditor: (props: any) => {
      mocks.lastDiffProps.push(props);
      React.useEffect(() => {
        props.onMount?.({ getOriginalEditor: vi.fn(), getModifiedEditor: vi.fn() }, monacoStub);
      }, []);
      return React.createElement('div', {
        'data-testid': 'mock-diff-editor',
        'data-original': props.original,
        'data-modified': props.modified,
      });
    },
  };
});

beforeEach(() => {
  mocks.readFile.mockReset();
  mocks.writeFile.mockReset();
  mocks.openInEditor.mockReset();
  mocks.setModelMarkers.mockClear();
  mocks.quickCommandRun.mockClear();
  mocks.findRun.mockClear();
  mocks.outlineRun.mockClear();
  mocks.lastEditorProps.length = 0;
  mocks.lastDiffProps.length = 0;
});

describe('CodeEditor Monaco workbench behavior', () => {
  it('opens files as Monaco path-backed models and shows editor status', async () => {
    mocks.readFile.mockResolvedValue('const saved = true;');

    render(
      <CodeEditor
        files={[{ path: '/repo/src/example.ts', label: 'example.ts', language: 'typescript' }]}
      />,
    );

    expect(await screen.findByDisplayValue('const saved = true;')).toBeInTheDocument();
    expect(mocks.lastEditorProps.at(-1)).toMatchObject({
      path: '/repo/src/example.ts',
      saveViewState: true,
      theme: 'pm-dark',
    });
    expect(mocks.lastEditorProps.at(-1).options.minimap.enabled).toBe(true);
    await waitFor(() => {
      expect(screen.getByText(/Ln\s+4,\s+Col\s+2/)).toBeInTheDocument();
    });
  });

  it('compares saved and working contents in the built-in diff view', async () => {
    mocks.readFile.mockResolvedValue('const saved = true;');

    render(
      <CodeEditor
        files={[{ path: '/repo/src/example.ts', label: 'example.ts', language: 'typescript' }]}
      />,
    );

    const editor = await screen.findByLabelText('mock monaco editor');
    fireEvent.change(editor, { target: { value: 'const changed = true;' } });
    fireEvent.click(screen.getByRole('button', { name: /^Diff$/i }));

    const diff = screen.getByTestId('mock-diff-editor');
    expect(diff).toHaveAttribute('data-original', 'const saved = true;');
    expect(diff).toHaveAttribute('data-modified', 'const changed = true;');
  });

  it('surfaces read failures as visible Monaco problems', async () => {
    mocks.readFile.mockRejectedValue(new Error('Access denied'));

    render(
      <CodeEditor
        files={[{ path: '/repo/src/blocked.ts', label: 'blocked.ts', language: 'typescript' }]}
      />,
    );

    expect(await screen.findByText(/Unable to read \/repo\/src\/blocked\.ts: Access denied/)).toBeInTheDocument();
    expect(screen.getByText('Problems 1')).toBeInTheDocument();
    expect(mocks.setModelMarkers).toHaveBeenCalled();
  });

  it('runs Monaco command, find, and outline actions from the workbench toolbar', async () => {
    render(
      <CodeEditor
        files={[
          {
            path: '/repo/src/example.ts',
            label: 'example.ts',
            language: 'typescript',
            content: 'const value = 1;',
          },
        ]}
      />,
    );

    await screen.findByDisplayValue('const value = 1;');

    fireEvent.click(screen.getByRole('button', { name: /^Command$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Find$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Outline$/i }));

    expect(mocks.quickCommandRun).toHaveBeenCalledTimes(1);
    expect(mocks.findRun).toHaveBeenCalledTimes(1);
    expect(mocks.outlineRun).toHaveBeenCalledTimes(1);
  });

  it('writes the active model and resets the saved diff baseline after save', async () => {
    mocks.readFile.mockResolvedValue('const saved = true;');
    mocks.writeFile.mockResolvedValue(undefined);

    render(
      <CodeEditor
        files={[{ path: '/repo/src/example.ts', label: 'example.ts', language: 'typescript' }]}
      />,
    );

    const editor = await screen.findByLabelText('mock monaco editor');
    fireEvent.change(editor, { target: { value: 'const saved = false;' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(mocks.writeFile).toHaveBeenCalledWith('/repo/src/example.ts', 'const saved = false;');
    });

    fireEvent.click(screen.getByRole('button', { name: /^Diff$/i }));
    const diff = screen.getByTestId('mock-diff-editor');
    expect(diff).toHaveAttribute('data-original', 'const saved = false;');
    expect(diff).toHaveAttribute('data-modified', 'const saved = false;');
  });
});
