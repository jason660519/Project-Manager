import { NextRequest, NextResponse } from 'next/server';

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
}

// ────────────────────────────────────────────────────────────────────────────
// Provider helpers — each returns a content string or throws.
// ────────────────────────────────────────────────────────────────────────────

async function callProvider(
  provider: string,
  model: string,
  messages: ChatApiMessage[],
  systemPrompt?: string,
): Promise<string> {
  const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (!apiKey) throw new Error(`${provider.toUpperCase()}_API_KEY not configured`);

  const sys = systemPrompt || getSystemPrompt();

  switch (provider) {
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

    case 'openai': {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: 'system', content: sys }, ...messages],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
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

    case 'deepseek':
    case 'grok':
    case 'kimi':
    case 'openrouter':
    case 'perplexity':
    case 'together':
    case 'zhipu':
    case 'qwen': {
      const baseUrls: Record<string, string> = {
        deepseek: 'https://api.deepseek.com',
        grok: 'https://api.x.ai',
        kimi: 'https://api.moonshot.ai/v1',
        openrouter: 'https://openrouter.ai/api',
        perplexity: 'https://api.perplexity.ai',
        together: 'https://api.together.xyz',
        zhipu: 'https://open.bigmodel.cn/api/paas/v4',
        qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      };
      const base = baseUrls[provider];
      if (!base) throw new Error(`Unknown provider: ${provider}`);
      const res = await fetch(`${base}/chat/completions`, {
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

/** Default model for each provider when none is specified. */
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-pro-latest',
  deepseek: 'deepseek-chat',
  grok: 'grok-2-latest',
  kimi: 'kimi-k2.6',
  openrouter: 'anthropic/claude-3.5-sonnet',
  perplexity: 'sonar',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  zhipu: 'glm-4-plus',
  qwen: 'qwen-plus',
};

/** Fallback chain when no provider is specified by the client. */
const FALLBACK_CHAIN = ['deepseek', 'anthropic', 'openai', 'gemini', 'grok'] as const;

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

  // Try user-specified provider first, then fall back to chain on failure
  const errors: string[] = [];
  const startProvider = body.provider;
  const providersToTry = startProvider
    ? [startProvider, ...FALLBACK_CHAIN.filter(p => p !== startProvider)]
    : [...FALLBACK_CHAIN];

  for (const provider of providersToTry) {
    try {
      const model = body.model || DEFAULT_MODELS[provider];
      const content = await callProvider(provider, model, body.messages, systemPrompt);
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
