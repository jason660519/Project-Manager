import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/keys/validate/route';

const outboundGetMock = vi.fn();
const outboundPostMock = vi.fn();

vi.mock('../lib/server/outboundHttp.server', () => ({
  outboundGet: (...args: unknown[]) => outboundGetMock(...args),
  outboundPost: (...args: unknown[]) => outboundPostMock(...args),
}));

function request(body: unknown) {
  return new Request('http://localhost/api/keys/validate', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never;
}

describe('keys validate API route', () => {
  beforeEach(() => {
    outboundGetMock.mockReset();
    outboundPostMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates Perplexity without probing the unsupported models endpoint first', async () => {
    outboundPostMock.mockResolvedValue({
      status: 200,
      headers: {},
      body: JSON.stringify({ id: 'completion' }),
    });

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
    expect(outboundPostMock).toHaveBeenCalledTimes(1);
    expect(outboundPostMock.mock.calls[0][0]).toBe('https://api.perplexity.ai/v1/sonar');
    expect(outboundGetMock).not.toHaveBeenCalled();
  });

  it('falls back from Moonshot China to the global endpoint for global Kimi keys', async () => {
    outboundGetMock
      .mockResolvedValueOnce({
        status: 401,
        headers: {},
        body: JSON.stringify({ error: { message: 'Invalid Authentication' } }),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        body: JSON.stringify({ data: [{ id: 'kimi-k2.6' }] }),
      });

    const res = await POST(
      request({
        apiKind: 'openai-compatible',
        baseUrl: 'https://api.moonshot.cn/v1',
        apiKey: 'sk-test',
      }),
    );
    const body = await res.json();

    expect(body).toEqual({ ok: true, models: ['kimi-k2.6'], errorReason: null });
    expect(outboundGetMock.mock.calls.map((call) => call[0])).toEqual([
      'https://api.moonshot.cn/v1/models',
      'https://api.moonshot.ai/v1/models',
    ]);
  });

  it('surfaces provider auth failures instead of a generic fetch failed message', async () => {
    outboundGetMock.mockResolvedValue({
      status: 401,
      headers: {},
      body: JSON.stringify({ error: { type: 'authentication_error' } }),
    });

    const res = await POST(
      request({
        apiKind: 'anthropic',
        apiKey: 'sk-ant-test',
      }),
    );
    const body = await res.json();

    expect(body.ok).toBe(false);
    expect(body.errorReason).toMatch(/Anthropic 401/);
    expect(body.errorReason).not.toBe('fetch failed');
  });

  it('still validates through outbound HTTP when global fetch is unusable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('native fetch blocked'))));
    outboundGetMock.mockResolvedValue({
      status: 200,
      headers: {},
      body: JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }),
    });

    const res = await POST(
      request({
        apiKind: 'openai-compatible',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-live-test',
      }),
    );
    const body = await res.json();

    expect(body).toEqual({ ok: true, models: ['gpt-4o-mini'], errorReason: null });
    expect(outboundGetMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({ authorization: 'Bearer sk-live-test' }),
    );
  });
});
