import { isPastTimeToday, todayKey } from './dates';
import type { Entry, Settings } from './types';

export const REMINDER_TAG = 'daily-reminder';
export const REMINDER_TITLE = 'Journal';
export const REMINDER_BODY = "Today's check-in is here whenever you're ready.";

/**
 * Whether a reminder notification is due right now: reminders are on, the set
 * time has passed today, today's check-in isn't finished, and no reminder has
 * gone out today already.
 */
export function reminderDue(settings: Settings, today: Entry | undefined, now: Date = new Date()): boolean {
  if (!settings.reminderEnabled) return false;
  if (today?.completedAt) return false;
  if (settings.lastReminderDate === todayKey(now)) return false;
  return isPastTimeToday(settings.reminderTime, now);
}

export type NotifySupport = 'ok' | 'unsupported' | 'denied' | 'default';

export function notificationSupport(): NotifySupport {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'ok';
  if (Notification.permission === 'denied') return 'denied';
  return 'default';
}

/** iOS only exposes notifications to web apps added to the Home Screen. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
