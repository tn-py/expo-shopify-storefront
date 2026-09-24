import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptic feedback. Every helper swallows its own errors —
 * haptics are a nice-to-have and must never surface as an unhandled rejection
 * (e.g. on devices/simulators without a haptics engine).
 */
export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticSelection(): void {
  Haptics.selectionAsync().catch(() => {});
}

export function hapticWarning(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
