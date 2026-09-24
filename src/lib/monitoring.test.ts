const Sentry = jest.requireMock('@sentry/react-native') as {
  init: jest.Mock;
  captureException: jest.Mock;
  setUser: jest.Mock;
  wrap: jest.Mock;
};

/** Re-imports the module with a given DSN so its module-scope config picks it up. */
function loadMonitoring(dsn: string): typeof import('./monitoring') {
  const original = process.env.EXPO_PUBLIC_SENTRY_DSN;
  process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
  let mod!: typeof import('./monitoring');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- re-import to re-run module-scope init under a fresh DSN
    mod = require('./monitoring');
  });
  process.env.EXPO_PUBLIC_SENTRY_DSN = original;
  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('without a DSN', () => {
  it('no-ops every helper', () => {
    const monitoring = loadMonitoring('');
    monitoring.initMonitoring();
    monitoring.captureException(new Error('boom'));
    monitoring.setMonitoringUser('customer-1');
    const Root = () => null;
    expect(monitoring.wrapRoot(Root)).toBe(Root);

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.setUser).not.toHaveBeenCalled();
    expect(Sentry.wrap).not.toHaveBeenCalled();
  });
});

describe('with a DSN configured', () => {
  it('initializes without sending default PII', () => {
    const monitoring = loadMonitoring('https://x@o1.ingest.sentry.io/1');
    monitoring.initMonitoring();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://x@o1.ingest.sentry.io/1',
        sendDefaultPii: false,
      }),
    );
  });

  it('forwards exceptions with extra context', () => {
    const monitoring = loadMonitoring('https://x@o1.ingest.sentry.io/1');
    const error = new Error('boom');
    monitoring.captureException(error, { screen: 'cart' });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, { extra: { screen: 'cart' } });
  });

  it('sets and clears the monitoring user', () => {
    const monitoring = loadMonitoring('https://x@o1.ingest.sentry.io/1');
    monitoring.setMonitoringUser('customer-1');
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'customer-1' });

    monitoring.setMonitoringUser(null);
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });

  it('wraps the root component', () => {
    const monitoring = loadMonitoring('https://x@o1.ingest.sentry.io/1');
    const Root = () => null;
    Sentry.wrap.mockReturnValue('wrapped');

    expect(monitoring.wrapRoot(Root)).toBe('wrapped');
    expect(Sentry.wrap).toHaveBeenCalledWith(Root);
  });
});
