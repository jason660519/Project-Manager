'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface MermaidBlockProps {
  code: string;
}

interface MermaidRendererMessage {
  type?: string;
  id?: string;
  requestId?: string;
  height?: number;
  error?: string;
}

type QueuedRender = () => Promise<void>;

let mermaidRenderQueue: Promise<void> = Promise.resolve();

function enqueueMermaidRender(render: QueuedRender) {
  const nextRender = mermaidRenderQueue.catch(() => undefined).then(render);
  mermaidRenderQueue = nextRender.catch(() => undefined);
  return nextRender;
}

/**
 * A highly decoupled, secure, and sandboxed Mermaid.js renderer.
 *
 * Performance:
 * By offloading the rendering and the massive Mermaid/d3 bundle into an isolated
 * static iframe, we prevent bloating the main Next.js webpack bundle and save
 * significant application build/load times.
 *
 * Security (XSS Sandbox):
 * Arbitrary user-provided spec diagrams are rendered within an iframe configured
 * with sandbox="allow-scripts". Since "allow-same-origin" is omitted, the iframe is
 * treated as a unique, completely isolated origin. It has zero access to localStorage,
 * cookies, the Tauri backend bridge, or system level execution APIs.
 */
export default function MermaidBlock({ code }: MermaidBlockProps) {
  const rawId = useId();
  // Safe alphanumeric ID for Mermaid and message routing (strip colons from useId)
  const instanceId = rawId.replace(/:/g, '');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const renderSequenceRef = useRef(0);
  const currentRequestIdRef = useRef<string | null>(null);
  const completionResolverRef = useRef<((value: void) => void) | null>(null);
  const [height, setHeight] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (event.source !== iframeWindow) return;

      const data = (event.data || {}) as MermaidRendererMessage;

      // Handle iframe readiness
      if (data.type === 'ready') {
        setIframeReady(true);
        return;
      }

      // Filter messages intended for this specific instance
      if (data.id !== instanceId) return;
      if (data.requestId !== currentRequestIdRef.current) return;

      if (data.type === 'resize' && typeof data.height === 'number') {
        setHeight(Math.max(1, Math.ceil(data.height)));
        setError(null);
        completionResolverRef.current?.();
        completionResolverRef.current = null;
      } else if (data.type === 'error' && typeof data.error === 'string') {
        setError(data.error);
        setHeight(0);
        completionResolverRef.current?.();
        completionResolverRef.current = null;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [instanceId]);

  // Push code to the iframe whenever it's ready, or code changes
  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;

    const requestId = `${instanceId}-${renderSequenceRef.current++}`;
    currentRequestIdRef.current = requestId;
    setError(null);
    setHeight(0);

    enqueueMermaidRender(
      () =>
        new Promise<void>((resolve) => {
          if (currentRequestIdRef.current !== requestId || !iframeRef.current?.contentWindow) {
            resolve();
            return;
          }

          completionResolverRef.current = resolve;
          const timeoutId = window.setTimeout(() => {
            if (currentRequestIdRef.current !== requestId) {
              resolve();
              return;
            }
            setError('Mermaid render timed out before the sandboxed renderer responded.');
            setHeight(0);
            completionResolverRef.current = null;
            resolve();
          }, 10000);

          const resolveOnce = () => {
            window.clearTimeout(timeoutId);
            resolve();
          };
          completionResolverRef.current = resolveOnce;

          // Send render command to sandboxed iframe.
          iframeRef.current.contentWindow.postMessage(
            {
              type: 'render',
              code,
              id: instanceId,
              requestId,
            },
            '*'
          );
        })
    );
  }, [code, iframeReady, instanceId]);

  useEffect(() => {
    return () => {
      completionResolverRef.current?.();
      completionResolverRef.current = null;
    };
  }, []);

  return (
    <div className="my-3 w-full max-w-full overflow-x-auto">
      {error && (
        <pre className="mb-2 whitespace-pre-wrap break-all rounded border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] leading-relaxed text-amber-400/80">
          <strong>Mermaid Syntax Error:</strong>
          <div className="mt-1 font-mono text-[10px] text-stone-300">{error}</div>
        </pre>
      )}
      {!height && !error && (
        <div className="border border-stone-200/10 bg-white/[0.03] px-3 py-2 text-[11px] text-stone-400" role="status">
          Rendering diagram...
        </div>
      )}
      {/*
        sandbox="allow-scripts" ensures the iframe runs JavaScript to render Mermaid,
        but because "allow-same-origin" is NOT present, it is completely sandboxed in
        a separate origin with zero access to our app's cookies, local storage, or Tauri window APIs.
      */}
      <iframe
        ref={iframeRef}
        src="/vendor/mermaid/index.html"
        className="w-full border-0 bg-transparent transition-all duration-200"
        style={{ height: error ? '0px' : height ? `${height}px` : '1px', opacity: height && !error ? 1 : 0 }}
        sandbox="allow-scripts"
        scrolling="no"
        title="Sandboxed Mermaid Diagram"
        aria-hidden={Boolean(error)}
      />
    </div>
  );
}
