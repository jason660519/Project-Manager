'use client';

import React from 'react';
import type { ArenaModelSpec } from './useArenaChat';
import type { ProviderLike } from './VlmArenaTypes';

interface VlmArenaModelCellProps {
  spec: ArenaModelSpec;
  providers: readonly ProviderLike[];
  onUpdateModel: (providerId: string, modelId: string) => void;
}

export function VlmArenaModelCell({ spec, providers, onUpdateModel }: VlmArenaModelCellProps) {
  const provider = providers.find((p) => p.id === spec.provider);

  return (
    <>
      <td className="px-3 py-2">
        <select
          value={spec.provider}
          onChange={(e) => {
            const nextProvider = providers.find((p) => p.id === e.target.value);
            onUpdateModel(e.target.value, nextProvider?.availableModels[0] || '');
          }}
          className="w-full min-w-[140px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id} className="bg-stone-900">
              {p.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={spec.model}
          onChange={(e) => onUpdateModel(spec.provider, e.target.value)}
          className="w-full min-w-[220px] bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1 px-2 outline-none font-mono"
        >
          {(provider?.availableModels ?? []).map((model) => (
            <option key={model} value={model} className="bg-stone-900">
              {model}
            </option>
          ))}
        </select>
      </td>
    </>
  );
}

