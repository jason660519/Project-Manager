import sampleConfig from '../config/samples/dev-pilot.sample.json';
import { listAdapters } from '../lib/adapters/registry';
import { DevPilotConfig } from '../lib/types';
import { DashboardClient } from './ui/DashboardClient';

const config = sampleConfig as DevPilotConfig;

export default function Home() {
  return (
    <DashboardClient
      project={config.project}
      features={config.features}
      adapters={listAdapters(config)}
    />
  );
}
