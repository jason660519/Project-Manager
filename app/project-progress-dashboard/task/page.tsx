import { Suspense } from 'react';
import { PromptTaskClient } from './PromptTaskClient';

export default function PromptTaskPage() {
  return (
    <Suspense fallback={<div className="p-6 text-stone-300 text-sm">Loading…</div>}>
      <PromptTaskClient />
    </Suspense>
  );
}
