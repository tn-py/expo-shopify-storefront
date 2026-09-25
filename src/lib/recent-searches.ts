/**
 * Pure helpers for the last-8-distinct-submitted-queries list shown as chips
 * on the Search screen's idle state. Persistence (AsyncStorage) lives in the
 * screen itself — these are just storage-shape transforms, kept free of
 * side effects so they're trivial to unit test.
 */

export const RECENT_SEARCHES_STORAGE_KEY = 'storefront.recentSearches.v1';
export const RECENT_SEARCHES_LIMIT = 8;

export function parseRecentSearches(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, RECENT_SEARCHES_LIMIT);
  } catch {
    return [];
  }
}

export function serializeRecentSearches(queries: string[]): string {
  return JSON.stringify(queries);
}

/** Moves `query` to the front, de-duplicating case-insensitively, capped at the limit. */
export function addRecentSearch(recent: string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return recent;
  const withoutExisting = recent.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
  return [trimmed, ...withoutExisting].slice(0, RECENT_SEARCHES_LIMIT);
}
