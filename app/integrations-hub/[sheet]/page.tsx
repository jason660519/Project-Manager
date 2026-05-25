import { notFound, redirect } from 'next/navigation';
import { MainClient } from '../../ui/MainClient';
import {
  INTEGRATION_SHEETS,
  LEGACY_PLUGINS_SHEET,
  SYSTEM_INSTALLED_APPS_SHEET,
  type IntegrationSheet,
} from '../../../lib/integrations/types';

const REMOVED_SHEETS: ReadonlyArray<IntegrationSheet> = ['vla', 'tts', 'stt', 'hands', 'tools'];
const REMOVED_SHEET_SET = new Set(REMOVED_SHEETS);
const VALID_SHEETS = INTEGRATION_SHEETS.filter((sheet) => !REMOVED_SHEET_SET.has(sheet));

export const dynamicParams = false;

export function generateStaticParams() {
  return VALID_SHEETS.map((sheet) => ({ sheet }));
}

export default async function IntegrationsHubSheetPage({
  params,
}: {
  params: Promise<{ sheet: string }>;
}) {
  const { sheet } = await params;
  if (sheet === LEGACY_PLUGINS_SHEET) {
    redirect(`/integrations-hub/${SYSTEM_INSTALLED_APPS_SHEET}`);
  }
  if (!VALID_SHEETS.includes(sheet as IntegrationSheet)) {
    notFound();
  }
  return (
    <MainClient
      currentView="integrations-hub"
      integrationsSheet={sheet as IntegrationSheet}
    />
  );
}
