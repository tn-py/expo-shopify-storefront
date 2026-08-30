import { useCallback, useRef } from 'react';

type PaginationRequest = (options: { cancelRefetch: false }) => Promise<unknown>;

export function usePaginationLock({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: PaginationRequest;
}) {
  const inFlight = useRef<Promise<unknown> | null>(null);

  return useCallback((): Promise<unknown> | undefined => {
    if (!hasNextPage || isFetchingNextPage) return undefined;
    if (inFlight.current) return inFlight.current;

    const request = Promise.resolve(fetchNextPage({ cancelRefetch: false }));
    const lockedRequest = request.finally(() => {
      if (inFlight.current === lockedRequest) inFlight.current = null;
    });
    inFlight.current = lockedRequest;
    return lockedRequest;
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
}
