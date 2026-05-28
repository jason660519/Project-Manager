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

    const res = await POST(request({
      provider: 'openai',
      model: 'o1',
      apiKey: 'sk-test',
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
  });
});
