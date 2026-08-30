import {
  parseSupportEmail,
  safeCustomerAccountManagementUrl,
  supportMailtoUrl,
} from './account-links';

describe('account link configuration', () => {
  it('accepts a plain configured support mailbox and builds an encoded subject', () => {
    expect(parseSupportEmail(' support@example.com ')).toBe('support@example.com');
    expect(supportMailtoUrl('support@example.com', 'Question about order #1001'))
      .toBe('mailto:support@example.com?subject=Question%20about%20order%20%231001');
  });

  it.each([
    'not-an-email',
    'support@example',
    'support..team@example.com',
    'Support <support@example.com>',
    'support@example.com?subject=Injected',
    'support@example.com\r\n',
    '\nsupport@example.com',
    'support@example.com\r\nBcc:attacker@example.com',
    'support@example.com\nSubject:Injected',
  ])('rejects invalid or header-injecting support email %s', (email) => {
    expect(parseSupportEmail(email)).toBeNull();
    expect(supportMailtoUrl(email, 'Order help')).toBeNull();
  });

  it('requires HTTPS for the hosted Shopify customer-account handoff', () => {
    expect(safeCustomerAccountManagementUrl('http://accounts.example.com/addresses'))
      .toBeNull();
    expect(safeCustomerAccountManagementUrl('https://accounts.example.com/addresses'))
      .toBe('https://accounts.example.com/addresses');
    expect(safeCustomerAccountManagementUrl('javascript:alert(1)')).toBeNull();
  });
});
