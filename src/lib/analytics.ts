import PostHog from 'posthog-react-native';

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

/** Null when PostHog isn't configured — every helper below then no-ops. */
export const posthog: PostHog | null = apiKey
  ? new PostHog(apiKey, { host, enableSessionReplay: false })
  : null;

type Props = Record<string, any>;

export function track(event: string, properties?: Props): void {
  posthog?.capture(event, properties);
}

export function screen(name: string, properties?: Props): void {
  posthog?.screen(name, properties);
}

export function identify(distinctId: string, properties?: Props): void {
  posthog?.identify(distinctId, properties);
}

export function resetAnalytics(): void {
  posthog?.reset();
}
