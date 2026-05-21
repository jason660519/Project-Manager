'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface MermaidBlockProps {
  code: string;
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
export default function MermaidBlock({ code }: { code: string }) {
  const rawId = useId();
  // Safe alphanumeric ID for Mermaid and message routing (strip colons from useId)
  const instanceId = rawId.replace(/:/g, '');
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data || {};
      
      // Handle iframe readiness
      if (data.type === 'ready' && event.source === iframeRef.current?.contentWindow) {
        setIframeReady(true);
        return;
      }

      // Filter messages intended for this specific instance
      if (data.id !== instanceId) return;

      if (data.type === 'resize' && typeof data.height === 'number') {
        setHeight(data.height);
        setError(null);
      } else if (data.type === 'error' && typeof data.error === 'string') {
        setError(data.error);
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

    // Send render command to sandboxed iframe
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'render',
        code,
        id: instanceId,
      },
      '*'
    );
  }, [code, iframeReady, instanceId]);

  if (error) {
    return (
      <div className="my-3 max-w-full">
        <pre className="text-[11px] text-amber-400/80 whitespace-pre-wrap break-all border border-amber-400/20 rounded p-3 bg-amber-400/5 leading-relaxed">
          <strong>Mermaid Syntax Error:</strong>
          <div className="mt-1 font-mono text-[10px] text-stone-300">{error}</div>
        </pre>
      </div>
    );
  }

  return (
    <div className="my-3 flex w-full justify-center overflow-x-auto">
      {/* 
        sandbox="allow-scripts" ensures the iframe runs JavaScript to render Mermaid,
        but because "allow-same-origin" is NOT present, it is completely sandboxed in
        a separate origin with zero access to our app's cookies, local storage, or Tauri window APIs.
      */}
      <iframe
        ref={iframeRef}
        src="/vendor/mermaid/index.html"
        className="w-full border-0 bg-transparent transition-all duration-200"
        style={{ height: height ? `${height}px` : '100px', opacity: height ? 1 : 0.4 }}
        sandbox="allow-scripts"
        scrolling="no"
        title="Sandboxed Mermaid Diagram"
      />
    </div>
  );
}
