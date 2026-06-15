/**
 * Server-only outbound HTTP for dev API routes (`app/api/**`).
 *
 * Node's global `fetch` (Undici) can fail TLS verification on some macOS/Node
 * combos with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` even when curl and the Rust
 * bridge succeed. Keys validation and other provider probes use this helper so
 * browser-mode dev matches real provider error codes (401, 404, …) instead of
 * a blanket "fetch failed".
 */

import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { URL } from 'node:url';

export interface OutboundHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function flattenHeaders(raw: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(', ');
  }
  return out;
}

function outboundRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
  timeoutMs = 30_000,
): Promise<OutboundHttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : isHttps ? 443 : 80,
        path: `${parsed.pathname}${parsed.search}`,
        headers,
        ca: isHttps ? [...tls.rootCertificates] : undefined,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: flattenHeaders(res.headers),
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );

    req.on('error', (error) => {
      const cause = error && typeof error === 'object' && 'code' in error
        ? String((error as NodeJS.ErrnoException).code ?? '')
        : '';
      if (cause) {
        reject(new Error(`${error.message} (${cause})`));
        return;
      }
      reject(error);
    });
    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });

    if (body !== undefined) req.write(body);
    req.end();
  });
}

export function outboundGet(
  url: string,
  headers: Record<string, string>,
  timeoutMs?: number,
): Promise<OutboundHttpResponse> {
  return outboundRequest('GET', url, headers, undefined, timeoutMs);
}

export function outboundPost(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs?: number,
): Promise<OutboundHttpResponse> {
  return outboundRequest('POST', url, headers, body, timeoutMs);
}
