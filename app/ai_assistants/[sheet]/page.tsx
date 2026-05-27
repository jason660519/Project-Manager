import { notFound, redirect } from 'next/navigation';
import { MainClient } from '../../ui/MainClient';
import type { AIAssistantSheetId } from '../../../lib/ai-assistants/types';

const VALID_SHEETS: AIAssistantSheetId[] = [
  'engineers',
  'overview',
  'profile',
  'skills',
  'daily-logs',
  'dreaming',
  'permissions',
  'audit',
];

export const dynamicParams = false;

export function generateStaticParams() {
  return VALID_SHEETS.map((sheet) => ({ sheet }));
}

export default async function AIAssistantsSheetPage({
  params,
}: {
  params: Promise<{ sheet: string }>;
}) {
  const { sheet } = await params;
  if (sheet === 'chat') {
    redirect('/ai_assistants');
  }
  if (sheet === 'instances') {
    redirect('/ai_assistants/overview');
  }
  if (!VALID_SHEETS.includes(sheet as AIAssistantSheetId)) {
    notFound();
  }
  return <MainClient currentView="chat" assistantSheet={sheet as AIAssistantSheetId} />;
}
