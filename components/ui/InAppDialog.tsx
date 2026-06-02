'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'neutral';
}

interface PromptOptions {
  title: string;
  message: ReactNode;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
}

interface AlertOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
}

interface ConfirmState extends ConfirmOptions {
  id: number;
}

interface PromptState extends PromptOptions {
  id: number;
  value: string;
}

interface AlertState extends AlertOptions {
  id: number;
}

export function InAppConfirmDialog({
  state,
  busy = false,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const tone = state.tone ?? 'danger';
  const confirmClass = tone === 'danger'
    ? 'border-rose-300/35 bg-rose-950/30 text-rose-100 hover:bg-rose-950/45'
    : 'border-stone-200/22 bg-stone-100 text-[rgb(var(--pm-panel))] hover:bg-amber-100';
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`in-app-confirm-title-${state.id}`}
        className="w-full max-w-md border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-200/12 px-4 py-3">
          <h3 id={`in-app-confirm-title-${state.id}`} className="text-sm font-semibold text-stone-100">
            {state.title}
          </h3>
          <div className="mt-2 text-xs leading-5 text-stone-400">
            {state.message}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="border border-stone-200/18 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-stone-300 hover:bg-stone-200/8 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {state.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex min-w-[100px] items-center justify-center gap-1.5 px-3 py-2 text-[11px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45 ${confirmClass}`}
          >
            {busy && <Loader2 size={12} className="animate-spin" />}
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InAppPromptDialog({
  state,
  onCancel,
  onChange,
  onSubmit,
}: {
  state: PromptState;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const inputClass = 'w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/50';
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`in-app-prompt-title-${state.id}`}
        className="w-full max-w-lg border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-200/12 px-4 py-3">
          <h3 id={`in-app-prompt-title-${state.id}`} className="text-sm font-semibold text-stone-100">
            {state.title}
          </h3>
          <div className="mt-2 text-xs leading-5 text-stone-400">
            {state.message}
          </div>
        </div>
        <div className="px-4 py-4">
          {state.multiline ? (
            <textarea
              value={state.value}
              onChange={(event) => onChange(event.target.value)}
              rows={10}
              className={`${inputClass} resize-y`}
              autoFocus
            />
          ) : (
            <input
              value={state.value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSubmit();
              }}
              className={inputClass}
              autoFocus
            />
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-stone-200/12 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="border border-stone-200/18 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-stone-300 hover:bg-stone-200/8"
          >
            {state.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="inline-flex min-w-[100px] items-center justify-center border border-stone-200/22 bg-stone-100 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--pm-panel))] hover:bg-amber-100"
          >
            {state.confirmLabel ?? 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InAppAlertDialog({
  state,
  onClose,
}: {
  state: AlertState;
  onClose: () => void;
}) {
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`in-app-alert-title-${state.id}`}
        className="w-full max-w-md border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-200/12 px-4 py-3">
          <h3 id={`in-app-alert-title-${state.id}`} className="text-sm font-semibold text-stone-100">
            {state.title}
          </h3>
          <div className="mt-2 text-xs leading-5 text-stone-400">
            {state.message}
          </div>
        </div>
        <div className="flex items-center justify-end px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-w-[100px] items-center justify-center border border-stone-200/22 bg-stone-100 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--pm-panel))] hover:bg-amber-100"
          >
            {state.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useInAppConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const idRef = useRef(0);

  const open = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    idRef.current += 1;
    resolver.current = resolve;
    setState({ ...options, id: idRef.current });
  }), []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  }, []);

  return {
    open,
    dialog: state ? (
      <InAppConfirmDialog
        state={state}
        onCancel={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    ) : null,
  };
}

export function useInAppAlert() {
  const [state, setState] = useState<AlertState | null>(null);
  const resolver = useRef<(() => void) | null>(null);
  const idRef = useRef(0);

  const open = useCallback((options: AlertOptions) => new Promise<void>((resolve) => {
    idRef.current += 1;
    resolver.current = resolve;
    setState({ ...options, id: idRef.current });
  }), []);

  const settle = useCallback(() => {
    resolver.current?.();
    resolver.current = null;
    setState(null);
  }, []);

  return {
    open,
    dialog: state ? (
      <InAppAlertDialog
        state={state}
        onClose={settle}
      />
    ) : null,
  };
}

export function useInAppPrompt() {
  const [state, setState] = useState<PromptState | null>(null);
  const resolver = useRef<((value: string | null) => void) | null>(null);
  const idRef = useRef(0);

  const open = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => {
    idRef.current += 1;
    resolver.current = resolve;
    setState({ ...options, id: idRef.current, value: options.defaultValue ?? '' });
  }), []);

  const settle = useCallback((value: string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  }, []);

  return {
    open,
    dialog: state ? (
      <InAppPromptDialog
        state={state}
        onCancel={() => settle(null)}
        onChange={(value) => setState((prev) => (prev ? { ...prev, value } : prev))}
        onSubmit={() => settle(state.value)}
      />
    ) : null,
  };
}
