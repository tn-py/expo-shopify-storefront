import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // catalog data changes slowly
      gcTime: 30 * 60 * 1000,
      retry: 1,
      // Safe now that `initQueryLifecycle()` (src/lib/query-lifecycle.ts) drives
      // focus from AppState instead of the (native-inapplicable) window focus
      // event — the 5-minute staleTime above still prevents over-fetching.
      refetchOnWindowFocus: true,
    },
  },
});
