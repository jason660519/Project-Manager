import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { POST } from '../app/api/chat/tools/file/route';

function request(body: unknown) {
  return new Request('http://localhost/api/chat/tools/file', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never;
}

describe('chat file tool route', () => {
  const dirs: string[] = [];

  afterEach(() => {
    while (dirs.length > 0) {
      rmSync(dirs.pop()!, { recursive: true, force: true });
    }
  });

  it('reads text files under the requested root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pm-file-route-'));
    dirs.push(root);
    writeFileSync(join(root, 'notes.md'), '# Notes\n\nHello');

    const res = await POST(request({ root, path: 'notes.md' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.path).toBe('notes.md');
    expect(body.content).toContain('# Notes');
    expect(body.lines).toBe(3);
  });

  it('blocks traversal outside the requested root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pm-file-route-'));
    dirs.push(root);

    const res = await POST(request({ root, path: '../outside.md' }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Path traversal denied');
  });
});
