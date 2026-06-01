import { describe, expect, it } from 'vitest';
import {
  buildChatProviderChain,
  getDefaultChatModel,
  openAiCompatibleBaseUrl,
  openAiCompatibleChatCompletionsUrl,
} from '../lib/chat/providerRouting';

describe('chat provider routing', () => {
  it('uses the canonical LLM registry for explicit provider defaults and URLs', () => {
    expect(getDefaultChatModel('huggingface')).toBe('meta-llama/Llama-3.1-8B-Instruct');
    expect(openAiCompatibleBaseUrl('huggingface')).toBe('https://router.huggingface.co/v1');
    expect(openAiCompatibleChatCompletionsUrl('ollama-local')).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('keeps explicit provider first while preserving server-side fallback routing', () => {
    expect(buildChatProviderChain({
      userProvider: 'openrouter',
      model: 'openai/gpt-4o',
    })[0]).toBe('openrouter');
    expect(buildChatProviderChain({
      userProvider: 'openrouter',
      model: 'openai/gpt-4o',
    })).toContain('openai');
  });
});
