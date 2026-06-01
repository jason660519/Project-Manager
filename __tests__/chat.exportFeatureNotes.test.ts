import { describe, expect, it } from 'vitest';
import { formatChatAsFeatureNotes } from '../lib/chat/exportFeatureNotes';

describe('formatChatAsFeatureNotes', () => {
  it('exports chat history using ingestion-compatible feature notes markers', () => {
    const markdown = formatChatAsFeatureNotes({
      title: 'Implement secure chat',
      projectName: 'Project Manager',
      featureId: 'F42',
      tags: ['security', 'runtime'],
      exportedAt: new Date('2026-06-01T00:00:00.000Z'),
      messages: [
        {
          id: 'u1',
          role: 'user',
          content: 'Please fix the chat boundary.',
          createdAt: Date.parse('2026-06-01T00:01:00.000Z'),
        },
        {
          id: 'a1',
          role: 'assistant',
          content: 'Renderer no longer sends API keys.',
          createdAt: Date.parse('2026-06-01T00:02:00.000Z'),
          provider: 'openai',
          model: 'gpt-4o',
          status: 'sent',
        },
      ],
    });

    expect(markdown).toContain('## Implement secure chat');
    expect(markdown).toContain('**Category:** AI Assistant Export');
    expect(markdown).toContain('**Status:** todo');
    expect(markdown).toContain('**Project:** Project Manager');
    expect(markdown).toContain('**Source Feature:** F42');
    expect(markdown).toContain('**Tags:** #security #runtime');
    expect(markdown).toContain('Provider: openai / gpt-4o');
    expect(markdown).toContain('Renderer no longer sends API keys.');
  });
});
