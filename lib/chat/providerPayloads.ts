import type { ChatAttachment } from './types';
import { dataUrlPayload, imageAttachments } from './multimodal';

interface TextMessage {
  role: string;
  content: string;
}

function imageData(attachments?: ChatAttachment[]) {
  return imageAttachments(attachments)
    .map((attachment) => {
      const parsed = attachment.dataUrl ? dataUrlPayload(attachment.dataUrl) : null;
      return parsed ? { ...parsed, dataUrl: attachment.dataUrl!, name: attachment.name } : null;
    })
    .filter((item): item is { mediaType: string; data: string; dataUrl: string; name: string } => Boolean(item));
}

export function buildOpenAiMessages(
  systemRole: 'system' | 'developer',
  systemPrompt: string,
  messages: TextMessage[],
  attachments?: ChatAttachment[],
): Array<Record<string, unknown>> {
  const providerMessages: Array<Record<string, unknown>> = [
    { role: systemRole, content: systemPrompt },
    ...messages.filter((message) => message.role !== 'system').map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
  const images = imageData(attachments);
  if (images.length === 0) return providerMessages;
  const lastUserIndex = providerMessages.findLastIndex((message) => message.role === 'user');
  if (lastUserIndex < 0) return providerMessages;
  const currentText = String(providerMessages[lastUserIndex].content ?? '');
  providerMessages[lastUserIndex] = {
    ...providerMessages[lastUserIndex],
    content: [
      { type: 'text', text: currentText || 'Please analyze the attached image.' },
      ...images.map((image) => ({
        type: 'image_url',
        image_url: { url: image.dataUrl },
      })),
    ],
  };
  return providerMessages;
}

export function buildAnthropicMessages(
  messages: TextMessage[],
  attachments?: ChatAttachment[],
): Array<Record<string, unknown>> {
  const providerMessages = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role, content: message.content as unknown }));
  const images = imageData(attachments);
  if (images.length === 0) return providerMessages;
  const lastUserIndex = providerMessages.findLastIndex((message) => message.role === 'user');
  if (lastUserIndex < 0) return providerMessages;
  const currentText = String(providerMessages[lastUserIndex].content ?? '');
  providerMessages[lastUserIndex] = {
    ...providerMessages[lastUserIndex],
    content: [
      { type: 'text', text: currentText || 'Please analyze the attached image.' },
      ...images.map((image) => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mediaType,
          data: image.data,
        },
      })),
    ],
  };
  return providerMessages;
}

export function buildGeminiContents(
  messages: TextMessage[],
  attachments?: ChatAttachment[],
): Array<{ role: string; parts: Array<Record<string, unknown>> }> {
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content } as Record<string, unknown>],
    }));
  const images = imageData(attachments);
  if (images.length === 0) return contents;
  const lastUserIndex = contents.findLastIndex((message) => message.role === 'user');
  if (lastUserIndex < 0) return contents;
  contents[lastUserIndex] = {
    ...contents[lastUserIndex],
    parts: [
      ...contents[lastUserIndex].parts,
      ...images.map((image) => ({
        inline_data: {
          mime_type: image.mediaType,
          data: image.data,
        },
      })),
    ],
  };
  return contents;
}
