import type { QueryClient } from '@tanstack/react-query';

export const customerQueryRoot = ['customer'] as const;

export function customerQueryKey(
  sessionKey: string,
  resource: 'orders' | 'order' | 'addresses',
  detail?: string,
) {
  return detail
    ? [...customerQueryRoot, sessionKey, resource, detail] as const
    : [...customerQueryRoot, sessionKey, resource] as const;
}

export async function clearCustomerQueries(client: QueryClient): Promise<void> {
  await client.cancelQueries({ queryKey: customerQueryRoot });
  client.removeQueries({ queryKey: customerQueryRoot });
}
