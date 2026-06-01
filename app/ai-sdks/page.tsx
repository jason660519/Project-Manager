'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_AI_SDKS_SHEET_SLUG } from '../../lib/aiSdks/sheetSlugs';

export default function AiSdksPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/ai-sdks/${DEFAULT_AI_SDKS_SHEET_SLUG}`);
  }, [router]);
  return null;
}
