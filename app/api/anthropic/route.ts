import { NextRequest, NextResponse } from 'next/server';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  model?: string;
  maxTokens?: number;
  messages: Message[];
}

// Proxy Anthropic API calls from the Next.js server layer so the API key
// never touches browser JS. Used only in browser/dev mode; Tauri mode calls
// the Rust `call_anthropic` command directly via IPC.
export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not set in server environment' },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null) as RequestBody | null;
  if (!body?.messages?.length) {
    return NextResponse.json({ error: 'messages is required' }, { status: 400 });
  }

  const model = typeof body.model === 'string' ? body.model : 'claude-sonnet-4-6';
  const maxTokens = typeof body.maxTokens === 'number' ? body.maxTokens : 4096;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: body.messages }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Anthropic API ${res.status}: ${text}` }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({
    content: data.content?.[0]?.text ?? '',
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  });
}
