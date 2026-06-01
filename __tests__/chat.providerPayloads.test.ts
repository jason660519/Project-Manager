import { describe, expect, it } from 'vitest';
import {
  buildAnthropicMessages,
  buildGeminiContents,
  buildOpenAiMessages,
} from '../lib/chat/providerPayloads';
import { formatAttachmentDisplayText, formatTextAttachmentBlock } from '../lib/chat/multimodal';
import type { ChatAttachment } from '../lib/chat/types';

const imageAttachment: ChatAttachment = {
  name: 'screen.png',
  type: 'image/png',
  size: 42,
  dataUrl: 'data:image/png;base64,aGVsbG8=',
};

describe('chat multimodal provider payloads', () => {
  it('formats image attachments for OpenAI chat completions', () => {
    const messages = buildOpenAiMessages('system', 'sys', [{ role: 'user', content: 'Describe it' }], [imageAttachment]);

    expect(messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(messages[1].content).toEqual([
      { type: 'text', text: 'Describe it' },
      { type: 'image_url', image_url: { url: imageAttachment.dataUrl } },
    ]);
  });

  it('formats image attachments for Anthropic messages', () => {
    const messages = buildAnthropicMessages([{ role: 'user', content: '' }], [imageAttachment]);

    expect(messages[0].content).toEqual([
      { type: 'text', text: 'Please analyze the attached image.' },
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' },
      },
    ]);
  });

  it('formats image attachments for Gemini contents', () => {
    const contents = buildGeminiContents([{ role: 'user', content: 'What changed?' }], [imageAttachment]);

    expect(contents[0]).toEqual({
      role: 'user',
      parts: [
        { text: 'What changed?' },
        { inline_data: { mime_type: 'image/png', data: 'aGVsbG8=' } },
      ],
    });
  });

  it('keeps text files as prompt context and images as display summaries', () => {
    const fileAttachment: ChatAttachment = {
      name: 'notes.md',
      type: 'text/markdown',
      size: 12,
      content: '# Notes',
    };

    expect(formatTextAttachmentBlock([imageAttachment, fileAttachment])).toContain('--- File: notes.md ---');
    expect(formatTextAttachmentBlock([imageAttachment])).toBe('');
    expect(formatAttachmentDisplayText([imageAttachment, fileAttachment])).toBe('[Image: screen.png]\n[File: notes.md]');
  });
});
