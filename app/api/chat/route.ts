import { NextRequest, NextResponse } from 'next/server';
import {
  buildChatProviderChain,
  getChatProviderSpec,
  getDefaultChatModel,
  openAiCompatibleChatCompletionsUrl,
  resolveChatProviderApiKey,
} from '../../../lib/chat/providerRouting';

interface ChatApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  messages: ChatApiMessage[];
  /** Provider id to use (e.g. "anthropic", "openai"). Omit for default chain. */
  provider?: string;
  /** Model override. Omit to use the provider's default. */
  model?: string;
  /** Custom system prompt override. Omit to use the default. */
  systemPrompt?: string;
  /** API key passed from the client (loaded from Keychain/localStorage). */
  apiKey?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Provider helpers — each returns a content string or throws.
// ────────────────────────────────────────────────────────────────────────────

async function callProvider(
  provider: string,
  model: string,
  messages: ChatApiMessage[],
  systemPrompt?: string,
  clientApiKey?: string,
): Promise<string> {
  const apiKey = resolveChatProviderApiKey(provider, clientApiKey);
  const providerSpec = getChatProviderSpec(provider);
  const sys = systemPrompt || getSystemPrompt();

  switch (providerSpec.apiKind) {
    case 'anthropic': {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: sys,
          messages: messages.filter((m) => m.role !== 'system'),
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data.content?.[0]?.text ?? '';
    }

    case 'gemini': {
      const contents: { role: string; parts: { text: string }[] }[] = [];
      for (const msg of messages) {
        if (msg.role === 'system') continue;
        contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] });
      }
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: sys }] },
            contents,
            generationConfig: { maxOutputTokens: 4096 },
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    case 'openai-compatible': {
      const res = await fetch(openAiCompatibleChatCompletionsUrl(provider), {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: 'system', content: sys }, ...messages],
        }),
      });
      if (!res.ok) throw new Error(`${provider} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
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

  const systemPrompt = body.systemPrompt;

  // When the client provides a specific API key (loaded from Keychain),
  // only try the user-requested provider — the key is provider-specific.
  const errors: string[] = [];
  const userProvider = body.provider && body.provider !== 'auto' ? body.provider : undefined;
  const providersToTry = buildChatProviderChain({
    model: body.model,
    userProvider,
    hasClientApiKey: Boolean(body.apiKey),
  });

  for (const provider of providersToTry) {
    try {
      const model = body.model || getDefaultChatModel(provider);
      const content = await callProvider(provider, model, body.messages, systemPrompt, body.apiKey);
      return NextResponse.json({ content, provider, model });
    } catch (e) {
      errors.push(`${provider}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json(
    { error: 'All AI providers failed', details: errors },
    { status: 500 },
  );
}
