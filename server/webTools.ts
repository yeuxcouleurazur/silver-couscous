import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower.startsWith('::ffff:')) {
    return isPrivateIpv4(lower.slice(7));
  }
  return false;
}

/**
 * Validate that a user-supplied URL is safe for server-side fetching:
 * - Only http: and https: schemes allowed
 * - Blocks loopback, private RFC1918, link-local, and cloud metadata addresses
 */
export function validatePublicUrl(
  rawUrl: string,
): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: 'URL invalide.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Seuls les protocoles http:// et https:// sont autorisés.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { ok: false, error: 'Accès bloqué : adresse locale ou interne non autorisée.' };
  }

  const ipVersion = net.isIP(hostname.replace(/^\[|\]$/g, ''));
  if (ipVersion === 4 && isPrivateIpv4(hostname)) {
    return { ok: false, error: 'Accès bloqué : adresse IP privée ou locale interdite.' };
  }
  if (ipVersion === 6 && isPrivateIpv6(hostname)) {
    return { ok: false, error: 'Accès bloqué : adresse IPv6 privée ou locale interdite.' };
  }

  return { ok: true, url: parsed };
}

/**
 * Convert raw HTML into clean readable plain text + extract title.
 */
export function extractReadableTextFromHtml(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim())
    : '';

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article|header|footer)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const decoded = decodeHtmlEntities(cleaned)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

  return {
    title,
    text: decoded.slice(0, 14000),
  };
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}
