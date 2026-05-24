import { NextRequest, NextResponse } from 'next/server';

type ProviderApiKind = 'anthropic' | 'openai-compatible' | 'gemini' | 'github';

interface ValidateRequestBody {
  apiKind?: unknown;
  apiKey?: unknown;
  baseUrl?: unknown;
}

function truncateError(text: string): string {
  return text.length <= 200 ? text : `${text.slice(0, 200)}...`;
}

function validationResult(ok: boolean, models: string[] = [], errorReason?: string) {
  return { ok, models, errorReason: errorReason ?? null };
}

async function readError(prefix: string, res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  return `${prefix} ${res.status}: ${truncateError(text)}`;
}

async function validateAnthropic(apiKey: string): Promise<string[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
  if (!res.ok) throw new Error(await readError('Anthropic', res));
  const raw = (await res.json()) as { data?: Array<{ id?: unknown }> };
  return raw.data?.flatMap((model) => (typeof model.id === 'string' ? [model.id] : [])) ?? [];
}

async function validateOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  allowMoonshotAlternate = true,
): Promise<string[]> {
  let normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  if (
    normalizedBaseUrl === 'http://localhost:11434/v1' &&
    process.env.OLLAMA_LOCAL_BASE_URL
  ) {
    normalizedBaseUrl = `${process.env.OLLAMA_LOCAL_BASE_URL.replace(/\/+$/, '')}/v1`;
  }

  if (normalizedBaseUrl === 'https://api.perplexity.ai') {
    return validatePerplexity(apiKey);
  }

  const res = await fetch(`${normalizedBaseUrl}/models`, {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok && allowMoonshotAlternate && isMoonshotBaseUrl(normalizedBaseUrl)) {
    const alternateBaseUrl = getAlternateMoonshotBaseUrl(normalizedBaseUrl);
    if (alternateBaseUrl) {
      return validateOpenAiCompatible(alternateBaseUrl, apiKey, false);
    }
  }
  if (!res.ok) throw new Error(await readError('Provider', res));
  const raw = (await res.json()) as { data?: Array<{ id?: unknown }> };
  return raw.data?.flatMap((model) => (typeof model.id === 'string' ? [model.id] : [])) ?? [];
}

async function validatePerplexity(apiKey: string): Promise<string[]> {
  const models = [
    'sonar',
    'sonar-pro',
    'sonar-deep-research',
    'sonar-reasoning',
    'sonar-reasoning-pro',
  ];
  const res = await fetch('https://api.perplexity.ai/v1/sonar', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  if (!res.ok) throw new Error(await readError('Perplexity', res));
  return models;
}

function isMoonshotBaseUrl(baseUrl: string): boolean {
  return baseUrl === 'https://api.moonshot.ai/v1' || baseUrl === 'https://api.moonshot.cn/v1';
}

function getAlternateMoonshotBaseUrl(baseUrl: string): string | null {
  if (baseUrl === 'https://api.moonshot.ai/v1') return 'https://api.moonshot.cn/v1';
  if (baseUrl === 'https://api.moonshot.cn/v1') return 'https://api.moonshot.ai/v1';
  return null;
}

async function validateGemini(apiKey: string): Promise<string[]> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    headers: {
      'x-goog-api-key': apiKey,
    },
  });
  if (!res.ok) throw new Error(await readError('Gemini', res));
  const raw = (await res.json()) as { models?: Array<{ name?: unknown }> };
  return (
    raw.models?.flatMap((model) => {
      if (typeof model.name !== 'string') return [];
      return [model.name.replace(/^models\//, '')];
    }) ?? []
  );
}

async function validateGithub(apiKey: string): Promise<string[]> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      authorization: `token ${apiKey}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'project-manager',
    },
  });
  if (!res.ok) throw new Error(await readError('GitHub', res));
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as ValidateRequestBody | null;
    const apiKind = body?.apiKind;
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : '';
    const baseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl : undefined;

    if (!apiKey) return NextResponse.json(validationResult(false, [], 'API key is empty'));
    if (
      apiKind !== 'anthropic' &&
      apiKind !== 'openai-compatible' &&
      apiKind !== 'gemini' &&
      apiKind !== 'github'
    ) {
      return NextResponse.json({ error: `Unknown apiKind: ${String(apiKind)}` }, { status: 400 });
    }

    let models: string[];
    switch (apiKind as ProviderApiKind) {
      case 'anthropic':
        models = await validateAnthropic(apiKey);
        break;
      case 'openai-compatible':
        if (!baseUrl) {
          return NextResponse.json(
            { error: 'openai-compatible requires baseUrl' },
            { status: 400 },
          );
        }
        models = await validateOpenAiCompatible(baseUrl, apiKey);
        break;
      case 'gemini':
        models = await validateGemini(apiKey);
        break;
      case 'github':
        models = await validateGithub(apiKey);
        break;
    }

    return NextResponse.json(validationResult(true, models));
  } catch (error) {
    return NextResponse.json(
      validationResult(false, [], error instanceof Error ? error.message : String(error)),
    );
  }
}
