'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IntegrationsHubPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/integrations-hub/plugins');
  }, [router]);
  return null;
}
