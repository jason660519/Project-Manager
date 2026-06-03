import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PROJECT_ROOT = '/Users/Project-Manager';

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('browser readFile bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects project-external absolute paths before calling the read-file API', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/project-manager-root') {
        return mockJsonResponse({ root: PROJECT_ROOT });
      }
      return mockJsonResponse({ content: 'unexpected' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { readFile } = await import('../lib/bridge');

    await expect(readFile('/Users/jasonmacbbookpro/.codex/skills/example/SKILL.md')).rejects.toThrow(
      'Access denied: path is outside the project directory',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith('/api/editor/read-file', expect.anything());
  });

  it('allows project-local absolute paths through the read-file API', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/project-manager-root') {
        return mockJsonResponse({ root: PROJECT_ROOT });
      }
      if (url === '/api/editor/read-file') {
        return mockJsonResponse({ content: 'ok' });
      }
      return mockJsonResponse({ error: 'unexpected url' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { readFile } = await import('../lib/bridge');

    await expect(readFile(`${PROJECT_ROOT}/docs/README.md`)).resolves.toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith('/api/editor/read-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `${PROJECT_ROOT}/docs/README.md` }),
    });
  });
});
