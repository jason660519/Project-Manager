import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/keys/validate/route';

function request(body: unknown) {
  return new Request('http://localhost/api/keys/validate', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never;
}

describe('keys validate API route', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates Perplexity without probing the unsupported models endpoint first', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'completion' }), { status: 200 }),
    );

    const res = await POST(
      request({
        apiKind: 'openai-compatible',
        baseUrl: 'https://api.perplexity.ai',
        apiKey: 'pplx-test',
      }),
    );
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.models).toContain('sonar');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.perplexity.ai/v1/sonar');
  });

  it('falls back from Moonshot China to the global endpoint for global Kimi keys', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid Authentication' } }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'kimi-k2.6' }] }), { status: 200 }),
      );

    const res = await POST(
      request({
        apiKind: 'openai-compatible',
        baseUrl: 'https://api.moonshot.cn/v1',
        apiKey: 'sk-test',
      }),
    );
    const body = await res.json();

    expect(body).toEqual({ ok: true, models: ['kimi-k2.6'], errorReason: null });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'https://api.moonshot.cn/v1/models',
      'https://api.moonshot.ai/v1/models',
    ]);
  });
});
