import type { ProductFilter } from '@/shopify/types';

export type SearchPresentationMode =
  | 'idle'
  | 'suggestions'
  | 'loading-results'
  | 'results'
  | 'empty-results';

export function resolveSearchPresentation({
  draftQuery,
  submittedQuery,
  predictiveCount,
  submittedCount,
  submittedPending,
}: {
  draftQuery: string;
  submittedQuery: string;
  predictiveCount: number;
  submittedCount: number;
  submittedPending: boolean;
}): { mode: SearchPresentationMode; query: string; count: number } {
  const draft = draftQuery.trim();
  const submitted = submittedQuery.trim();
  if (draft.length < 2) return { mode: 'idle', query: draft, count: 0 };

  if (submitted.length >= 2 && submitted === draft) {
    if (submittedPending) return { mode: 'loading-results', query: submitted, count: 0 };
    return submittedCount
      ? { mode: 'results', query: submitted, count: submittedCount }
      : { mode: 'empty-results', query: submitted, count: 0 };
  }

  return { mode: 'suggestions', query: draft, count: predictiveCount };
}

export function canLoadNextPage({
  hasNextPage,
  isFetchingNextPage,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}): boolean {
  return hasNextPage && !isFetchingNextPage;
}

export function getCatalogColumnCount(width: number): 2 | 3 {
  return width >= 700 ? 3 : 2;
}

export function getSupportedFilters(filters: ProductFilter[] | undefined): ProductFilter[] {
  return (filters ?? []).filter(
    (filter) =>
      (filter.type === 'LIST' || filter.type === 'BOOLEAN') && filter.values.length > 0,
  );
}
