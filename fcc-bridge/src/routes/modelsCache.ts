/** Shared, lazily-refreshed cache of FCC-served model ids.
 *
 * The stream handler needs the live FCC model list to resolve requested
 * modelIds. We fetch it on demand and cache briefly so /v1/claude/stream
 * doesn't round-trip FCC on every request.
 */

import { discoverModels } from '../fccDiscovery';

let cache: { ids: string[]; at: number } | null = null;
const TTL_MS = 60_000;

export async function getCachedModelIds(fccBaseUrl: string): Promise<string[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.ids;
  try {
    const models = await discoverModels(fccBaseUrl);
    const ids = models.map((m) => m.id).filter(Boolean);
    cache = { ids, at: now };
    return ids;
  } catch {
    return cache ? cache.ids : [];
  }
}

export function invalidateModelCache(): void {
  cache = null;
}
