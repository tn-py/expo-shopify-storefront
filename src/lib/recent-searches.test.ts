import {
  addRecentSearch,
  parseRecentSearches,
  RECENT_SEARCHES_LIMIT,
  serializeRecentSearches,
} from '@/lib/recent-searches';

describe('recent searches', () => {
  it('adds a new query to the front', () => {
    expect(addRecentSearch([], 'linen')).toEqual(['linen']);
    expect(addRecentSearch(['linen'], 'denim')).toEqual(['denim', 'linen']);
  });

  it('de-duplicates case-insensitively and moves the repeat to the front', () => {
    expect(addRecentSearch(['linen', 'denim'], 'Linen')).toEqual(['Linen', 'denim']);
  });

  it('trims whitespace and ignores an empty query', () => {
    expect(addRecentSearch(['linen'], '  denim  ')).toEqual(['denim', 'linen']);
    expect(addRecentSearch(['linen'], '   ')).toEqual(['linen']);
  });

  it('keeps only the last 8 distinct queries', () => {
    const queries = Array.from({ length: RECENT_SEARCHES_LIMIT }, (_, i) => `q${i}`);
    const next = addRecentSearch(queries, 'newest');
    expect(next).toHaveLength(RECENT_SEARCHES_LIMIT);
    expect(next[0]).toBe('newest');
    expect(next).not.toContain(`q${RECENT_SEARCHES_LIMIT - 1}`);
  });

  it('round-trips through JSON persistence', () => {
    const queries = ['linen', 'denim'];
    expect(parseRecentSearches(serializeRecentSearches(queries))).toEqual(queries);
  });

  it('drops corrupted or malformed persisted data instead of throwing', () => {
    expect(parseRecentSearches(null)).toEqual([]);
    expect(parseRecentSearches('not json')).toEqual([]);
    expect(parseRecentSearches('{"not":"an array"}')).toEqual([]);
    expect(parseRecentSearches(JSON.stringify(['ok', 42, '']))).toEqual(['ok']);
  });
});
