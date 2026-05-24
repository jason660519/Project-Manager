'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_KEYS_SHEET_SLUG } from '../ui/views/Keys/KeysContext';

export default function KeysPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/keys/${DEFAULT_KEYS_SHEET_SLUG}`);
  }, [router]);
  return null;
}
