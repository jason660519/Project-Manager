import { NextRequest } from 'next/server';

interface ChatApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  model?: string;
  messages: ChatApiMessage[];
}

// ────────────────────────────────────────────────────────────────────────────
// Streaming chat API using SSE (Server-Sent Events).
// Tries providers: Anthropic → OpenAI → Gemini
// ────────────────────────────────────────────────────────────────────────────

function getSystemPrompt(): string {
  return [
    'You are the Project Manager AI assistant — a helpful, concise AI embedded in a project management dashboard.',
    '',
    'You can answer questions about project management, software development, and general technical topics.',
    'Keep answers concise and actionable. Use Markdown formatting when helpful.',
    'When asked about specific projects or features without context, explain you need more info.',
    'Be friendly but professional. Keep it brief.',
  ].join('\n');
}

/** Parse SSE data lines from a raw HTTP stream, yielding text chunks. */
async function* parseSSE<T>(reader: ReadableStreamDefaultReader<Uint8Array>, parser: (json: T) => string): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const prefix = 'data: ';
      if (!trimmed.startsWith(prefix)) continue;
      const jsonStr = trimmed.slice(prefix.length);
      if (jsonStr === '[DONE]') return;
      try {
        const text = parser(JSON.parse(jsonStr));
        if (text) yield text;
      } catch { /* skip malformed lines */ }
    }
  }
}

// ── Anthropic streaming ──────────────────────────────────────────────

async function* streamAnthropic(messages: ChatApiMessage[]): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      stream: true,
      system: getSystemPrompt(),
      messages: messages.filter((m) => m.role !== 'system'),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  yield* parseSSE<{ delta?: { text?: string }; type?: string }>(reader, (json) => {
    // Anthropic SSE: content_block_delta events carry delta.text
    return json.delta?.text ?? '';
  });
}

// ── OpenAI streaming ─────────────────────────────────────────────────

async function* streamOpenAI(messages: ChatApiMessage[]): AsyncGenerator<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      stream: true,
      messages: [
        { role: 'system', content: getSystemPrompt() },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  yield* parseSSE<{ choices?: { delta?: { content?: string } }[] }>(reader, (json) => {
    return json.choices?.[0]?.delta?.content ?? '';
  });
}

// ── Gemini streaming ─────────────────────────────────────────────────

async function* streamGemini(messages: ChatApiMessage[]): AsyncGenerator<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: getSystemPrompt() }] },
        contents,
        generationConfig: { maxOutputTokens: 4096 },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  yield* parseSSE<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>(reader, (json) => {
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  });
}

// ────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as RequestBody | null;
  if (!body?.messages?.length) {
    return new Response(JSON.stringify({ error: 'messages is required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Attempt each provider until one starts streaming.
  // Providers that throw during the first `next()` call are skipped.
  const errors: string[] = [];
  const providers: [string, () => AsyncGenerator<string>][] = [
    ['anthropic', () => streamAnthropic(body.messages)],
    ['openai', () => streamOpenAI(body.messages)],
    ['gemini', () => streamGemini(body.messages)],
  ];

  for (const [name, genFn] of providers) {
    try {
      const gen = genFn();
      // Pre-authorization check: advance to first yield so we catch auth/rate errors
      // before committing to the streaming response.
      const iterator = gen[Symbol.asyncIterator]();
      const first = await iterator.next();

      // Build a wrapper generator that includes the pre-fetched first chunk
      async function* withFirst(): AsyncGenerator<string> {
        if (first.done) return;
        yield first.value;
        yield* gen;
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of withFirst()) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          } catch (e) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          'connection': 'keep-alive',
          'x-ai-provider': name,
        },
      });
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
    }
  }

  return new Response(JSON.stringify({ error: 'All AI providers failed', details: errors }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  });
}
