import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listDirectoryEntriesMock = vi.fn();

vi.mock('../lib/bridge', () => ({
  listDirectoryEntries: (path: string) => listDirectoryEntriesMock(path),
}));

import { FolderContent } from '../components/folder/FolderContent';

describe('FolderContent', () => {
  beforeEach(() => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {},
      configurable: true,
    });
    listDirectoryEntriesMock.mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('loads a valid project root that contains spaces and non-ASCII characters', async () => {
    listDirectoryEntriesMock.mockResolvedValueOnce([
      {
        name: 'src',
        path: '/repo/Project-Manager/internal-resources/test-fixtures/client-alpha/src',
        isDir: true,
        isSymlink: false,
      },
    ]);

    render(
      <FolderContent
        itemId="folder-special"
        rootPath="/repo/Project-Manager/internal-resources/test-fixtures/client-alpha"
      />,
    );

    await waitFor(() => {
      expect(listDirectoryEntriesMock).toHaveBeenCalledWith(
        '/repo/Project-Manager/internal-resources/test-fixtures/client-alpha',
      );
    });
    expect(await screen.findByText('src')).toBeInTheDocument();
  });

  it('shows validation errors without calling the filesystem bridge', async () => {
    render(<FolderContent itemId="folder-invalid" rootPath="relative/project" />);

    expect(await screen.findByText(/absolute local path/i)).toBeInTheDocument();
    expect(listDirectoryEntriesMock).not.toHaveBeenCalled();
  });

  it('surfaces permission errors from the directory listing command', async () => {
    listDirectoryEntriesMock.mockRejectedValueOnce(
      new Error('Cannot read directory /Volumes/private/project: Permission denied'),
    );

    render(<FolderContent itemId="folder-denied" rootPath="/Volumes/private/project" />);

    expect(await screen.findByText(/Permission denied/i)).toBeInTheDocument();
  });
});
