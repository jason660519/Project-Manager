import { notFound } from 'next/navigation';
import { MainClient } from '../../ui/MainClient';
import { INTEGRATION_SHEETS, type IntegrationSheet } from '../../../lib/integrations/types';

const VALID_SHEETS = [...INTEGRATION_SHEETS];

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
