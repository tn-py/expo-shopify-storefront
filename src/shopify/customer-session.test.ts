import { QueryClient } from '@tanstack/react-query';

import { clearCustomerQueries, customerQueryKey } from './customer-session';

describe('customer session query boundaries', () => {
  it('does not expose customer A order data under customer B query keys', () => {
    const client = new QueryClient();
    client.setQueryData(customerQueryKey('session-a', 'orders'), ['order-a']);

    expect(client.getQueryData(customerQueryKey('session-b', 'orders'))).toBeUndefined();
    client.clear();
  });

  it('removes every customer query at sign-out without clearing public catalog data', async () => {
    const client = new QueryClient();
    client.setQueryData(customerQueryKey('session-a', 'orders'), ['order-a']);
    client.setQueryData(customerQueryKey('session-a', 'addresses'), ['address-a']);
    client.setQueryData(['products'], ['public-product']);

    await clearCustomerQueries(client);

    expect(client.getQueriesData({ queryKey: ['customer'] })).toEqual([]);
    expect(client.getQueryData(['products'])).toEqual(['public-product']);
    client.clear();
  });
});
