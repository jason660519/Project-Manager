'use client';

import { Settings2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { listLlmProviders } from '../../lib/keys/llmProviders';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ChatSettingsData {
  provider: string;
  model: string;
  systemPrompt: string;
}

interface ChatSettingsProps {
  current: ChatSettingsData;
  onChange: (settings: ChatSettingsData) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Storage
// ────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pm-chat-settings';

export function loadChatSettings(): ChatSettingsData {
  if (typeof window === 'undefined') return { provider: 'auto', model: '', systemPrompt: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { provider: 'auto', model: '', systemPrompt: '' };
}

export function saveChatSettings(settings: ChatSettingsData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const ALL_PROVIDERS = listLlmProviders();

export function ChatSettings({ current, onChange }: ChatSettingsProps) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(current.provider);
  const [model, setModel] = useState(current.model);
  const [systemPrompt, setSystemPrompt] = useState(current.systemPrompt);
  const [hasChanged, setHasChanged] = useState(false);

  // Sync local state when current changes externally
  useEffect(() => {
    setProvider(current.provider);
    setModel(current.model);
    setSystemPrompt(current.systemPrompt);
  }, [current]);

  const currentSpec = ALL_PROVIDERS.find((p) => p.id === provider);
  const models = currentSpec?.availableModels ?? [];
  const providerChanged = provider !== current.provider;
  const modelChanged = model !== current.model;
  const promptChanged = systemPrompt !== current.systemPrompt;
  const dirty = providerChanged || modelChanged || promptChanged;

  // Reset model when provider changes (and the current model isn't valid for the new provider)
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    if (newProvider === 'auto') {
      setModel('');
      return;
    }
    const spec = ALL_PROVIDERS.find((p) => p.id === newProvider);
    if (spec && !spec.availableModels.includes(model)) {
      setModel(spec.availableModels[0] || spec.defaultModel || '');
    }
  };

  const handleApply = () => {
    const settings: ChatSettingsData = { provider, model, systemPrompt };
    saveChatSettings(settings);
    onChange(settings);
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded px-1.5 py-1 text-[10px] transition-colors ${
          provider !== 'auto'
            ? 'text-amber-300/80 hover:text-amber-200'
            : 'text-stone-500 hover:text-stone-300'
        }`}
        title="Chat settings"
      >
        <Settings2 size={12} />
      </button>

      {/* Settings panel */}
      {open && (
        <>
          {/* Backdrop to close on click outside */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 w-72 rounded-lg border border-stone-200/20 bg-[#1e1e1e] p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                Chat Settings
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="text-stone-500 hover:text-stone-300">
                <X size={12} />
              </button>
            </div>

            {/* Provider */}
            <label className="mb-1 block text-[9px] uppercase tracking-[0.1em] text-stone-500">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="mb-2 w-full rounded border border-stone-200/15 bg-stone-900 px-2 py-1 text-[11px] text-stone-200 outline-none focus:border-amber-200/40"
            >
              <option value="auto">Auto (fallback chain)</option>
              {ALL_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>

            {/* Model */}
            {provider !== 'auto' && (
              <>
                <label className="mb-1 mt-2 block text-[9px] uppercase tracking-[0.1em] text-stone-500">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mb-2 w-full rounded border border-stone-200/15 bg-stone-900 px-2 py-1 text-[11px] text-stone-200 outline-none focus:border-amber-200/40"
                >
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* System prompt */}
            <label className="mb-1 mt-2 block text-[9px] uppercase tracking-[0.1em] text-stone-500">
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Default: Project Manager AI assistant..."
              rows={3}
              className="mb-3 w-full resize-none rounded border border-stone-200/15 bg-stone-900 px-2 py-1 text-[10px] text-stone-300 outline-none placeholder:text-stone-600 focus:border-amber-200/40"
            />

            {/* Apply */}
            <button
              type="button"
              onClick={handleApply}
              className={`w-full rounded py-1.5 text-[10px] font-medium transition-colors ${
                dirty
                  ? 'bg-amber-500/15 text-amber-100 hover:bg-amber-500/25'
                  : 'bg-stone-800/50 text-stone-500 cursor-default'
              }`}
            >
              {dirty ? 'Apply' : 'No changes'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
