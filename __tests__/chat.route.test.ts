import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/chat/route';

function request(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never;
}

describe('chat route provider payloads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uses the OpenAI reasoning-model token parameter contract', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'I am o1.' } }],
          usage: { prompt_tokens: 11, completion_tokens: 7 },
          model: 'o1',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('OPENAI_API_KEY', 'sk-server');

    const res = await POST(request({
      provider: 'openai',
      model: 'o1',
      apiKey: 'sk-client-should-be-ignored',
      systemPrompt: 'System instructions',
      temperature: 0.7,
      maxTokens: 123,
      messages: [{ role: 'user', content: 'Who are you?' }],
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.content).toBe('I am o1.');
    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(payload.max_completion_tokens).toBe(123);
    expect(payload.max_tokens).toBeUndefined();
    expect(payload.temperature).toBeUndefined();
    expect(payload.messages[0]).toEqual({ role: 'developer', content: 'System instructions' });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: 'Bearer sk-server',
    });
  });

  it('keeps provider keys server-side while forwarding image attachments as model payload', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'The image shows a dashboard.' } }],
          usage: { prompt_tokens: 21, completion_tokens: 8 },
          model: 'gpt-4o',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('OPENAI_API_KEY', 'sk-server');

    const res = await POST(request({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-client-should-be-ignored',
      systemPrompt: 'System instructions',
      messages: [{ role: 'user', content: 'Describe this screenshot' }],
      attachments: [{
        name: 'screenshot.png',
        type: 'image/png',
        size: 12,
        dataUrl: 'data:image/png;base64,aGVsbG8=',
      }],
    }));

    expect(res.status).toBe(200);
    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(payload.apiKey).toBeUndefined();
    expect(payload.messages[1].content).toEqual([
      { type: 'text', text: 'Describe this screenshot' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=' } },
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: 'Bearer sk-server',
    });
  });
});
