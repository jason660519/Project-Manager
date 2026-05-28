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
  maxTokens?: number;
  temperature?: number;
}

interface ChatProviderResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

function isOpenAiReasoningModel(provider: string, model: string): boolean {
  return provider === 'openai' && /^(o\d|gpt-5)/i.test(model.trim());
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
  maxTokens = 4096,
  temperature?: number,
): Promise<ChatProviderResponse> {
  const apiKey = resolveChatProviderApiKey(provider, clientApiKey);
  const providerSpec = getChatProviderSpec(provider);
  const sys = systemPrompt || getSystemPrompt();
  const estimateTokens = (text: string) => Math.max(0, Math.ceil(text.length / 4));

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
          max_tokens: maxTokens,
          system: sys,
          messages: messages.filter((m) => m.role !== 'system'),
          ...(typeof temperature === 'number' ? { temperature } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const content = data.content?.[0]?.text ?? '';
      return {
        content,
        inputTokens: data.usage?.input_tokens ?? estimateTokens(`${sys}\n${messages.map((m) => m.content).join('\n')}`),
        outputTokens: data.usage?.output_tokens ?? estimateTokens(content),
        model,
      };
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
            generationConfig: {
              maxOutputTokens: maxTokens,
              ...(typeof temperature === 'number' ? { temperature } : {}),
            },
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return {
        content,
        inputTokens: data.usageMetadata?.promptTokenCount ?? estimateTokens(`${sys}\n${messages.map((m) => m.content).join('\n')}`),
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? estimateTokens(content),
        model,
      };
    }

    case 'openai-compatible': {
      const usesReasoningPayload = isOpenAiReasoningModel(provider, model);
      const tokenLimit = usesReasoningPayload
        ? { max_completion_tokens: maxTokens }
        : { max_tokens: maxTokens };
      const providerMessages = usesReasoningPayload
        ? [{ role: 'developer', content: sys }, ...messages.filter((m) => m.role !== 'system')]
        : [{ role: 'system', content: sys }, ...messages];
      const res = await fetch(openAiCompatibleChatCompletionsUrl(provider), {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          ...tokenLimit,
          ...(!usesReasoningPayload && typeof temperature === 'number' ? { temperature } : {}),
          messages: providerMessages,
        }),
      });
      if (!res.ok) throw new Error(`${provider} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      return {
        content,
        inputTokens: data.usage?.prompt_tokens ?? estimateTokens(`${sys}\n${messages.map((m) => m.content).join('\n')}`),
        outputTokens: data.usage?.completion_tokens ?? estimateTokens(content),
        model: data.model ?? model,
      };
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
  const maxTokens =
    typeof body.maxTokens === 'number' && Number.isFinite(body.maxTokens)
      ? Math.max(1, Math.min(8192, Math.round(body.maxTokens)))
      : 4096;
  const temperature =
    typeof body.temperature === 'number' && Number.isFinite(body.temperature)
      ? Math.max(0, Math.min(2, body.temperature))
      : undefined;

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
      const response = await callProvider(
        provider,
        model,
        body.messages,
        systemPrompt,
        body.apiKey,
        maxTokens,
        temperature,
      );
      return NextResponse.json({ ...response, provider, model: response.model || model });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[api/chat] provider failed', { provider, model: body.model, message });
      errors.push(`${provider}: ${message}`);
    }
  }

  return NextResponse.json(
    { error: 'All AI providers failed', details: errors },
    { status: 500 },
  );
}
