import { notFound } from 'next/navigation';
import { MainClient } from '../../ui/MainClient';
import {
  AI_SDKS_SHEET_SLUGS,
  type AiSdksSheetSlug,
} from '../../../lib/aiSdks/sheetSlugs';

const VALID_SHEETS = [...AI_SDKS_SHEET_SLUGS];

export const dynamicParams = false;

export function generateStaticParams() {
  return VALID_SHEETS.map((sheet) => ({ sheet }));
}

export default async function AiSdksSheetPage({
  params,
}: {
  params: Promise<{ sheet: string }>;
}) {
  const { sheet } = await params;
  if (!VALID_SHEETS.includes(sheet as AiSdksSheetSlug)) {
    notFound();
  }
  return <MainClient currentView="ai-sdks" aiSdksSheet={sheet as AiSdksSheetSlug} />;
}
