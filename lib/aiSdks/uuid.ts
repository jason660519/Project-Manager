/**
 * Deterministic RFC 4122 v5 UUIDs for AI SDKs model rows.
 *
 * Each row's `col-id` is a UUID derived from its stable natural key
 * (`<providerId>:<model>`) via UUIDv5. Because v5 is deterministic, every
 * install / export / DB seed computes the *same* UUID for the same model — so
 * `ai-sdks.json` stays portable and the id is a safe future database primary
 * key. (A random surrogate would differ per machine and break that.)
 *
 * Self-contained: a small synchronous SHA-1 (no async crypto, no dependency) so
 * ids can be computed during render.
 */

function sha1(bytes: Uint8Array): Uint8Array {
  const bitLen = bytes.length * 8;
  const withPad = bytes.length + 1;
  const total = withPad + ((56 - (withPad % 64) + 64) % 64) + 8;
  const msg = new Uint8Array(total);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  const dv = new DataView(msg.buffer);
  dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000));
  dv.setUint32(total - 4, bitLen >>> 0);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let i = 0; i < total; i += 64) {
    for (let j = 0; j < 16; j += 1) w[j] = dv.getUint32(i + j * 4);
    for (let j = 16; j < 80; j += 1) {
      const n = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = ((n << 1) | (n >>> 31)) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j += 1) {
      let f: number;
      let k: number;
      if (j < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, h0);
  odv.setUint32(4, h1);
  odv.setUint32(8, h2);
  odv.setUint32(12, h3);
  odv.setUint32(16, h4);
  return out;
}

function parseUuid(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  return bytes;
}

function formatUuid(bytes: Uint8Array): string {
  const h = Array.from(bytes, (x) => x.toString(16).padStart(2, '0'));
  return (
    `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-` +
    `${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`
  );
}

/** RFC 4122 v5 UUID = SHA-1(namespace ++ name), with version/variant bits set. */
export function uuidv5(name: string, namespace: string): string {
  const ns = parseUuid(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const data = new Uint8Array(ns.length + nameBytes.length);
  data.set(ns);
  data.set(nameBytes, ns.length);
  const hash = sha1(data).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
  return formatUuid(hash);
}

/** Fixed namespace for AI SDKs model-row ids (do not change — would re-key all rows). */
export const AI_SDKS_ID_NAMESPACE = '5f6e2b1a-0c3d-4e5f-8a9b-1c2d3e4f5061';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Deterministic row id (col-id) from a natural key like `anthropic:claude-opus-4-7`. */
export function rowIdFromNaturalKey(naturalKey: string): string {
  return uuidv5(naturalKey, AI_SDKS_ID_NAMESPACE);
}

/** Deterministic row id (col-id) for a (provider, model) pair. */
export function modelRowId(providerId: string, model: string): string {
  return rowIdFromNaturalKey(`${providerId}:${model}`);
}
