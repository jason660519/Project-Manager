'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IntegrationsHubPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/integrations-hub/system_installed_apps');
  }, [router]);
  return null;
}
