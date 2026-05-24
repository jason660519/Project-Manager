import { notFound } from 'next/navigation';
import { MainClient } from '../../ui/MainClient';
import {
  KEYS_SHEET_SLUGS,
  type KeysSheetSlug,
} from '../../../lib/keys/sheetSlugs';

const VALID_SHEETS = [...KEYS_SHEET_SLUGS];

export const dynamicParams = false;

export function generateStaticParams() {
  return VALID_SHEETS.map((sheet) => ({ sheet }));
}

export default async function KeysSheetPage({
  params,
}: {
  params: Promise<{ sheet: string }>;
}) {
  const { sheet } = await params;
  if (!VALID_SHEETS.includes(sheet as KeysSheetSlug)) {
    notFound();
  }
  return <MainClient currentView="keys" keysSheet={sheet as KeysSheetSlug} />;
}
