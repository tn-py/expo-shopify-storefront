import {
  canLoadNextPage,
  getCatalogColumnCount,
  getSupportedFilters,
  resolveSearchPresentation,
} from '@/components/commerce/catalog-state';

describe('catalog presentation state', () => {
  it('never substitutes predictive products for an empty submitted result set', () => {
    expect(
      resolveSearchPresentation({
        draftQuery: 'linen',
        submittedQuery: 'linen',
        predictiveCount: 3,
        submittedCount: 0,
        submittedPending: false,
      }),
    ).toEqual({ mode: 'empty-results', query: 'linen', count: 0 });
  });

  it('shows predictive suggestions only before a query is submitted', () => {
    expect(
      resolveSearchPresentation({
        draftQuery: 'lin',
        submittedQuery: '',
        predictiveCount: 3,
        submittedCount: 0,
        submittedPending: false,
      }),
    ).toEqual({ mode: 'suggestions', query: 'lin', count: 3 });
  });

  it('gates pagination at the end and while any next-page request is active', () => {
    expect(canLoadNextPage({ hasNextPage: true, isFetchingNextPage: false })).toBe(true);
    expect(canLoadNextPage({ hasNextPage: true, isFetchingNextPage: true })).toBe(false);
    expect(canLoadNextPage({ hasNextPage: false, isFetchingNextPage: false })).toBe(false);
  });

  it('uses two columns on phones and three on tablets', () => {
    expect(getCatalogColumnCount(390)).toBe(2);
    expect(getCatalogColumnCount(768)).toBe(3);
  });

  it('only exposes filter controls backed by supported Storefront capabilities', () => {
    expect(
      getSupportedFilters([
        {
          id: 'filter.v.option.color',
          label: 'Color',
          type: 'LIST',
          values: [
            { id: 'red', label: 'Red', count: 2, input: { variantOption: { name: 'Color', value: 'Red' } } },
          ],
        },
        { id: 'filter.price', label: 'Price', type: 'PRICE_RANGE', values: [] },
        { id: 'filter.empty', label: 'Empty', type: 'LIST', values: [] },
      ]),
    ).toEqual([
      {
        id: 'filter.v.option.color',
        label: 'Color',
        type: 'LIST',
        values: [
          { id: 'red', label: 'Red', count: 2, input: { variantOption: { name: 'Color', value: 'Red' } } },
        ],
      },
    ]);
    expect(getSupportedFilters(undefined)).toEqual([]);
  });
});
