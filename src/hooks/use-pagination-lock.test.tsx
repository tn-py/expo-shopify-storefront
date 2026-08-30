import { render } from '@testing-library/react-native';
import { useEffect } from 'react';

import { usePaginationLock } from './use-pagination-lock';

let loadNextPage: (() => Promise<unknown> | undefined) | null = null;

function Probe({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: (options: { cancelRefetch: false }) => Promise<unknown>;
}) {
  const load = usePaginationLock({ hasNextPage, isFetchingNextPage, fetchNextPage });
  useEffect(() => {
    loadNextPage = load;
  }, [load]);
  return null;
}

describe('usePaginationLock', () => {
  beforeEach(() => {
    loadNextPage = null;
  });

  it('uses one synchronous lock for rapid end-reached and retry calls', async () => {
    let finish!: () => void;
    const fetchNextPage = jest.fn(() => new Promise<void>((resolve) => {
      finish = resolve;
    }));
    await render(
      <Probe
        hasNextPage
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
      />,
    );

    const first = loadNextPage!();
    const second = loadNextPage!();

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(fetchNextPage).toHaveBeenCalledWith({ cancelRefetch: false });
    expect(second).toBe(first);

    finish();
    await first;
    loadNextPage!();
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['no next page', false, false],
    ['an external fetch is active', true, true],
  ])('does not start pagination when %s', async (_case, hasNextPage, isFetchingNextPage) => {
    const fetchNextPage = jest.fn().mockResolvedValue(undefined);
    await render(
      <Probe
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
      />,
    );

    loadNextPage!();

    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
