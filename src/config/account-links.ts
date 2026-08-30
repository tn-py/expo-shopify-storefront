export function parseSupportEmail(value: string | null | undefined): string | null {
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const email = value.trim();
  if (!email || email.length > 254) return null;

  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (
    !local || local.length > 64 || local.startsWith('.') || local.endsWith('.')
    || local.includes('..') || !/^[A-Za-z0-9._+-]+$/.test(local)
  ) return null;

  const labels = domain.split('.');
  if (domain.length > 253 || labels.length < 2 || labels.some((label) =>
    !label || label.length > 63 || label.startsWith('-') || label.endsWith('-')
    || !/^[A-Za-z0-9-]+$/.test(label)
  )) return null;

  return email;
}

export function configuredSupportEmail(): string | null {
  return parseSupportEmail(process.env.EXPO_PUBLIC_SUPPORT_EMAIL);
}

export function supportMailtoUrl(
  emailValue: string | null | undefined,
  subject?: string,
): string | null {
  const email = parseSupportEmail(emailValue);
  if (!email) return null;
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;
}

function safeUrl(
  value: string | null | undefined,
  protocols: readonly string[],
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function safeCustomerAccountManagementUrl(
  value: string | null | undefined,
): string | null {
  return safeUrl(value, ['https:']);
}

export function safeExternalHttpUrl(value: string | null | undefined): string | null {
  return safeUrl(value, ['https:', 'http:']);
}
