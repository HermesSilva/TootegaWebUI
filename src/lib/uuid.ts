/**
 * safeRandomUUID — UUID generator that works in NON-secure contexts.
 *
 * `crypto.randomUUID()` is only available in secure contexts (https / localhost).
 * When the dev server is reached over plain HTTP on the LAN (e.g. http://192.168.x.x:3003)
 * `crypto.randomUUID` is `undefined`, so calling it throws — and at module-load scope that
 * blanks the whole app. This helper prefers the native API and otherwise builds a RFC-4122
 * v4 UUID from `crypto.getRandomValues` (available in insecure contexts too), falling back
 * to `Math.random` only as a last resort.
 */
export function safeRandomUUID(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;

  if (c?.randomUUID)
    return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c?.getRandomValues)
    c.getRandomValues(bytes);
  else
    for (let i = 0; i < 16; i++)
      bytes[i] = Math.floor(Math.random() * 256);

  // RFC 4122 v4: set version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}
