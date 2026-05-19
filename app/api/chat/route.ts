import { NextRequest, NextResponse } from 'next/server';

interface ChatApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  model?: string;
  messages: ChatApiMessage[];
}

// ────────────────────────────────────────────────────────────────────────────
// Proxy chat completions through the server layer so API keys stay server-side.
// Priority: Anthropic → OpenAI → Gemini fallback
// ────────────────────────────────────────────────────────────────────────────

async function callAnthropic(messages: ChatApiMessage[]): Promise<string> {
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
      system: getSystemPrompt(),
      messages: messages.filter((m) => m.role !== 'system'),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

async function callOpenAI(messages: ChatApiMessage[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: getSystemPrompt() },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(messages: ChatApiMessage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  // Convert messages to Gemini format
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue; // Gemini uses system_instruction
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

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

// ────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as RequestBody | null;
  if (!body?.messages?.length) {
    return NextResponse.json({ error: 'messages is required' }, { status: 400 });
  }

  // Try providers in order of preference
  const errors: string[] = [];

  // 1. Anthropic (preferred)
  try {
    const content = await callAnthropic(body.messages);
    return NextResponse.json({ content, provider: 'anthropic' });
  } catch (e) {
    errors.push(`Anthropic: ${(e as Error).message}`);
  }

  // 2. OpenAI fallback
  try {
    const content = await callOpenAI(body.messages);
    return NextResponse.json({ content, provider: 'openai' });
  } catch (e) {
    errors.push(`OpenAI: ${(e as Error).message}`);
  }

  // 3. Gemini fallback
  try {
    const content = await callGemini(body.messages);
    return NextResponse.json({ content, provider: 'gemini' });
  } catch (e) {
    errors.push(`Gemini: ${(e as Error).message}`);
  }

  return NextResponse.json(
    { error: 'All AI providers failed', details: errors },
    { status: 500 },
  );
}
