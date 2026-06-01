import { NextRequest } from 'next/server';
import {
  buildChatProviderChain,
  getChatProviderSpec,
  getDefaultChatModel,
  openAiCompatibleChatCompletionsUrl,
  resolveChatProviderApiKey,
} from '../../../../lib/chat/providerRouting';
import {
  buildAnthropicMessages,
  buildGeminiContents,
  buildOpenAiMessages,
} from '../../../../lib/chat/providerPayloads';
import type { ChatAttachment } from '../../../../lib/chat/types';

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
  attachments?: ChatAttachment[];
}

// ────────────────────────────────────────────────────────────────────────────
// Streaming chat API using SSE (Server-Sent Events).
// Accepts `provider` + `model` or falls back to default chain.
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

// ── Provider streaming generators ──────────────────────────────────────

async function* streamProvider(
  provider: string,
  model: string,
  messages: ChatApiMessage[],
  systemPrompt?: string,
  attachments?: ChatAttachment[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const apiKey = resolveChatProviderApiKey(provider);
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
          stream: true,
          system: sys,
          messages: buildAnthropicMessages(messages, attachments),
        }),
        signal,
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');
      yield* parseSSE<{ delta?: { text?: string }; type?: string }>(reader, (json) => json.delta?.text ?? '');
      return;
    }

    case 'gemini': {
      const contents = buildGeminiContents(messages, attachments);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: sys }] },
            contents,
            generationConfig: { maxOutputTokens: 4096 },
          }),
          signal,
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');
      yield* parseSSE<Record<string, unknown>>(reader, (json) => {
        const cands = json.candidates as Array<Record<string, unknown>> | undefined;
        if (!cands) return '';
        const content = cands[0]?.content as Record<string, unknown> | undefined;
        const parts = content?.parts as Array<Record<string, unknown>> | undefined;
        return (parts?.[0]?.text as string) ?? '';
      });
      return;
    }

    case 'openai-compatible': {
      const res = await fetch(openAiCompatibleChatCompletionsUrl(provider), {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: true,
          messages: buildOpenAiMessages('system', sys, messages, attachments),
        }),
        signal,
      });
      if (!res.ok) throw new Error(`${provider} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');
      yield* parseSSE<{ choices?: { delta?: { content?: string } }[] }>(reader, (json) => json.choices?.[0]?.delta?.content ?? '');
      return;
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/** Build a streaming Response for a given (provider, model) pair. */
function makeStreamResponse(
  provider: string,
  model: string,
  gen: AsyncGenerator<string>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of gen) {
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
      'x-ai-provider': provider,
      'x-ai-model': model,
    },
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

  const systemPrompt = body.systemPrompt;

  const errors: string[] = [];
  const userProvider = body.provider && body.provider !== 'auto' ? body.provider : undefined;
  const providersToTry = buildChatProviderChain({
    model: body.model,
    userProvider,
  });

  for (const provider of providersToTry) {
    const model = body.model || getDefaultChatModel(provider);
    try {
      const gen = streamProvider(provider, model, body.messages, systemPrompt, body.attachments, request.signal);
      const iterator = gen[Symbol.asyncIterator]();
      const first = await iterator.next();
      async function* withFirst(): AsyncGenerator<string> {
        if (first.done) return;
        yield first.value;
        yield* gen;
      }
      return makeStreamResponse(provider, model, withFirst());
    } catch (e) {
      errors.push(`${provider}: ${(e as Error).message}`);
    }
  }

  return new Response(JSON.stringify({ error: 'All AI providers failed', details: errors }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  });
}
