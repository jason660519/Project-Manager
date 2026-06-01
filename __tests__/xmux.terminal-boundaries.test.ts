import { describe, expect, it } from 'vitest';
import { POST } from '../app/api/xmux/terminal/route';
import { NextRequest } from 'next/server';

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest('http://localhost:43187/api/xmux/terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('xmux terminal API boundaries', () => {
  it('blocks sudo commands', async () => {
    const res = await post({ command: 'sudo ls', cwd: process.cwd() });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.output).toContain('blocked');
  });

  it('blocks unknown commands under default-deny', async () => {
    const res = await post({ command: 'unknown-cli --help', cwd: process.cwd() });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.output).toContain('default_deny');
  });

  it('allows pwd when cwd is valid', async () => {
    const res = await post({ command: 'pwd', cwd: process.cwd() });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.output.length).toBeGreaterThan(0);
  });
});
