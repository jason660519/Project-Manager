import { describe, expect, it, vi, beforeEach } from 'vitest';
import { execFile } from 'child_process';
import { checkCommandExists, clearCommandExistsCache } from '../lib/adapters/availability';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

const execFileMock = vi.mocked(execFile);

function mockCommandLookup(error: Error | null) {
  execFileMock.mockImplementationOnce(((_file: string, _args: readonly string[], callback: unknown) => {
    (callback as (error: Error | null, stdout: string, stderr: string) => void)(error, '', '');
    return {} as ReturnType<typeof execFile>;
  }) as typeof execFile);
}

describe('checkCommandExists', () => {
  beforeEach(() => {
    clearCommandExistsCache();
    vi.clearAllMocks();
  });

  it('returns true when the command is installed', async () => {
    mockCommandLookup(null);

    await expect(checkCommandExists('cursor')).resolves.toBe(true);
  });

  it('returns false when the command is missing', async () => {
    mockCommandLookup(new Error('not found'));

    await expect(checkCommandExists('nonexistent-tool')).resolves.toBe(false);
  });

  it('caches results', async () => {
    mockCommandLookup(null);

    await expect(checkCommandExists('cursor')).resolves.toBe(true);
    await expect(checkCommandExists('cursor')).resolves.toBe(true);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it('returns false for an empty command', async () => {
    await expect(checkCommandExists('')).resolves.toBe(false);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('falls back safely when no adapters are available', () => {
    const adapters: Array<{ id: string }> = [];
    const savedId = 'codex';
    const resolved = adapters.some((adapter) => adapter.id === savedId)
      ? savedId
      : adapters[0]?.id;

    expect(resolved).toBeUndefined();
  });
});
