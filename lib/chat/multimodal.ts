import type { ChatAttachment } from './types';

export function dataUrlPayload(dataUrl: string): { mediaType: string; data: string } | null {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

export function imageAttachments(attachments?: ChatAttachment[]): ChatAttachment[] {
  return (attachments ?? []).filter((attachment) =>
    Boolean(attachment.dataUrl) && attachment.type.toLowerCase().startsWith('image/'),
  );
}

export function fileAttachments(attachments?: ChatAttachment[]): ChatAttachment[] {
  return (attachments ?? []).filter((attachment) => !imageAttachments([attachment]).length);
}

export function formatTextAttachmentBlock(attachments?: ChatAttachment[]): string {
  const files = fileAttachments(attachments);
  if (files.length === 0) return '';
  return files
    .map((file) => {
      const body = file.content ? `\`\`\`\n${file.content.slice(0, 5000)}\n\`\`\`` : '(no text content)';
      return `--- File: ${file.name} ---\n${body}\n---`;
      })
      .join('\n\n');
}

export function formatAttachmentDisplayText(attachments?: ChatAttachment[]): string {
  if (!attachments?.length) return '';
  return attachments
    .map((attachment) => {
      const label = attachment.type.toLowerCase().startsWith('image/') ? 'Image' : 'File';
      return `[${label}: ${attachment.name}]`;
    })
    .join('\n');
}
