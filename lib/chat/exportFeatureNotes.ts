import type { ChatMessage } from './types';

function cleanHeading(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return 'AI Assistant Conversation';
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value)) return 'unknown time';
  return new Date(value).toISOString();
}

function providerLine(message: ChatMessage): string | null {
  const parts = [message.provider, message.model].filter(Boolean);
  return parts.length > 0 ? `Provider: ${parts.join(' / ')}` : null;
}

export function formatChatAsFeatureNotes({
  title,
  messages,
  projectName,
  featureId,
  tags = [],
  exportedAt = new Date(),
}: {
  title: string;
  messages: ChatMessage[];
  projectName?: string;
  featureId?: string;
  tags?: string[];
  exportedAt?: Date;
}): string {
  const userTurns = messages.filter((message) => message.role === 'user').length;
  const assistantTurns = messages.filter((message) => message.role === 'assistant').length;
  const heading = cleanHeading(title);
  const metadata = [
    `**Category:** AI Assistant Export`,
    `**Status:** todo`,
    `**Exported At:** ${exportedAt.toISOString()}`,
    projectName ? `**Project:** ${projectName}` : null,
    featureId ? `**Source Feature:** ${featureId}` : null,
    tags.length > 0 ? `**Tags:** ${tags.map((tag) => `#${tag}`).join(' ')}` : null,
    `**Turns:** ${userTurns} user / ${assistantTurns} assistant`,
  ].filter(Boolean);

  const transcript = messages.map((message, index) => {
    const role = message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System';
    return [
      `### Turn ${index + 1}: ${role}`,
      '',
      `Time: ${formatTimestamp(message.createdAt)}`,
      providerLine(message),
      message.status ? `Status: ${message.status}` : null,
      '',
      message.content.trim() || '(empty)',
    ].filter((line) => line !== null).join('\n');
  });

  return [
    `## ${heading}`,
    '',
    ...metadata,
    '',
    '### Notes',
    '',
    'Conversation exported from Project Manager AI Assistant for review before converting into canonical feature work.',
    '',
    ...transcript,
    '',
  ].join('\n');
}
