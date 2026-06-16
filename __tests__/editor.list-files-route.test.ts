import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { POST } from '../app/api/editor/list-files/route';

function request(body: unknown) {
  return new Request('http://localhost/api/editor/list-files', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never;
}

describe('editor list-files route', () => {
  it('lists project files for browser dev sidecar loading', async () => {
    const root = path.resolve('.project-manager/features/F54');

    const res = await POST(request({ root, maxDepth: 1 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'README.md',
          isDir: false,
        }),
      ]),
    );
  });

  it('blocks paths outside the project root', async () => {
    const res = await POST(request({ root: '/tmp', maxDepth: 1 }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Access denied: path is outside the project directory');
  });
});
