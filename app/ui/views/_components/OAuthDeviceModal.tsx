'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, X } from 'lucide-react';
import { githubOAuthDeviceStart, githubOAuthDevicePoll } from '../../../../lib/bridge';
import { saveProviderSecret } from '../../../../lib/keys/keychain';
import type { ProviderSpec } from '../../../../lib/keys/registry';

interface OAuthDeviceModalProps {
  provider: ProviderSpec;
  onClose: () => void;
  onAuthorized: () => void;
}

type Phase =
  | { kind: 'starting' }
  | {
      kind: 'awaiting';
      userCode: string;
      verificationUri: string;
      deviceCode: string;
      interval: number;
    }
  | { kind: 'saving' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

export function OAuthDeviceModal({ provider, onClose, onAuthorized }: OAuthDeviceModalProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const [copied, setCopied] = useState(false);
  // Hold the latest cancel signal so the polling loop can exit when the modal
  // closes mid-flight (otherwise the user could close the modal and have a
  // stale poller still write a token).
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    void (async () => {
      if (!provider.oauthConfig) {
        setPhase({ kind: 'error', message: 'Provider has no OAuth config.' });
        return;
      }
      try {
        const code = await githubOAuthDeviceStart(provider.oauthConfig.scopes);
        if (cancelledRef.current) return;
        setPhase({
          kind: 'awaiting',
          userCode: code.userCode,
          verificationUri: code.verificationUri,
          deviceCode: code.deviceCode,
          interval: code.interval,
        });
        await pollUntilDone(code.deviceCode, code.interval);
      } catch (e) {
        if (cancelledRef.current) return;
        setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id]);

  async function pollUntilDone(deviceCode: string, intervalSec: number) {
    let interval = intervalSec;
    // 15 minutes hard cap on the total wait so a forgotten modal cleans itself up.
    const startedAt = Date.now();
    while (!cancelledRef.current) {
      if (Date.now() - startedAt > 15 * 60 * 1000) {
        setPhase({ kind: 'error', message: 'Authorization timed out.' });
        return;
      }
      await sleep(interval * 1000);
      if (cancelledRef.current) return;
      try {
        const res = await githubOAuthDevicePoll(deviceCode);
        if (cancelledRef.current) return;
        if (res.status === 'pending') continue;
        if (res.status === 'slow_down') {
          interval = res.interval;
          continue;
        }
        if (res.status === 'expired') {
          setPhase({ kind: 'error', message: 'Code expired. Please try again.' });
          return;
        }
        if (res.status === 'access_denied') {
          setPhase({ kind: 'error', message: 'Authorization was denied.' });
          return;
        }
        if (res.status === 'authorized') {
          setPhase({ kind: 'saving' });
          await saveProviderSecret(provider, res.access_token);
          if (cancelledRef.current) return;
          setPhase({ kind: 'done' });
          onAuthorized();
          return;
        }
      } catch (e) {
        if (cancelledRef.current) return;
        setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
        return;
      }
    }
  }

  const handleCopy = (code: string) => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Sign in to ${provider.label}`}
    >
      <div className="flex w-full max-w-md flex-col border border-stone-200/20 bg-[#071d1a]">
        <header className="flex items-center justify-between border-b border-stone-200/12 px-5 py-3">
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
            Sign in to {provider.label}
          </h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200" aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="px-5 py-5 text-sm">
          {phase.kind === 'starting' && (
            <Loading text="Requesting a device code from GitHub…" />
          )}

          {phase.kind === 'awaiting' && (
            <div className="space-y-4">
              <ol className="list-decimal space-y-2 pl-5 text-stone-300">
                <li>
                  Open{' '}
                  <a
                    href={phase.verificationUri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
                  >
                    {phase.verificationUri} <ExternalLink size={11} />
                  </a>
                </li>
                <li>Enter this code:</li>
              </ol>
              <div className="flex items-center justify-between border border-stone-200/22 bg-[#03100f] px-4 py-3">
                <span className="font-mono text-2xl tracking-[0.22em] text-stone-50">
                  {phase.userCode}
                </span>
                <button
                  onClick={() => handleCopy(phase.userCode)}
                  className="text-stone-500 hover:text-stone-200"
                  aria-label="Copy code"
                >
                  {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-stone-400">
                <Loader2 size={11} className="animate-spin" />
                Waiting for you to authorize in the browser…
              </div>
            </div>
          )}

          {phase.kind === 'saving' && <Loading text="Saving token to Keychain…" />}

          {phase.kind === 'done' && (
            <div className="flex items-center gap-2 text-emerald-300">
              <Check size={14} /> Connected. Token stored in Keychain.
            </div>
          )}

          {phase.kind === 'error' && (
            <div className="space-y-2">
              <p className="text-red-300">{phase.message}</p>
              {phase.message.startsWith('OAUTH_NOT_CONFIGURED') && (
                <p className="text-[11px] text-stone-400">
                  Register a GitHub OAuth App with Device Flow enabled, then launch PM with{' '}
                  <code className="font-mono text-stone-300">PM_GITHUB_OAUTH_CLIENT_ID=&lt;id&gt;</code>.
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="border-t border-stone-200/12 px-5 py-3 text-right">
          <button
            onClick={onClose}
            className="border border-stone-200/22 px-4 py-1.5 text-sm text-stone-300 hover:bg-stone-200/8"
          >
            {phase.kind === 'done' ? 'Close' : 'Cancel'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-stone-400">
      <Loader2 size={14} className="animate-spin" /> {text}
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
