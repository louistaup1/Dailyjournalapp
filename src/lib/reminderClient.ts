import { getEntry, getSettings, setSettings } from '../db';
import { nextOccurrence, todayKey } from './dates';
import { REMINDER_BODY, REMINDER_TAG, REMINDER_TITLE, notificationSupport, reminderDue } from './reminders';
import { pushConfigured, syncPush } from './push';

type PeriodicSyncManager = {
  register(tag: string, opts: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
};

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return undefined;
  }
}

export async function showReminder(test = false): Promise<boolean> {
  if (notificationSupport() !== 'ok') return false;
  const reg = await registration();
  if (!reg) return false;
  await reg.showNotification(REMINDER_TITLE, {
    body: test ? 'This is how the daily reminder will look.' : REMINDER_BODY,
    tag: REMINDER_TAG,
    icon: 'pwa-192x192.png',
    badge: 'badge-96x96.png',
    data: { url: './#/checkin' },
  });
  return true;
}

/** Notify if due, but only while the app is in the background. */
async function check(): Promise<void> {
  if (pushConfigured() || document.visibilityState === 'visible') return;
  const settings = await getSettings();
  if (!reminderDue(settings, await getEntry(todayKey()))) return;
  if (await showReminder()) await setSettings({ lastReminderDate: todayKey() });
}

let timer: number | undefined;

async function schedule(): Promise<void> {
  window.clearTimeout(timer);
  const s = await getSettings();
  if (!s.reminderEnabled) return;
  const ms = Math.min(nextOccurrence(s.reminderTime).getTime() - Date.now() + 1000, 2 ** 31 - 1);
  timer = window.setTimeout(async () => {
    await check();
    void schedule();
  }, ms);
}

/**
 * Keep the in-page reminder timer and the periodic background check (Android
 * Chrome, installed app) in step with the settings.
 */
export async function syncReminders(): Promise<void> {
  if (!pushConfigured()) void schedule();
  // With a push server, reminders and the weekly recap arrive even when the app is closed.
  void syncPush(await registration());
  if (pushConfigured()) return;
  const s = await getSettings();
  const reg = await registration();
  const ps = (reg as ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManager } | undefined)?.periodicSync;
  if (!ps) return;
  try {
    if (s.reminderEnabled && notificationSupport() === 'ok') {
      const perm = await navigator.permissions?.query({ name: 'periodic-background-sync' as PermissionName });
      if (perm?.state === 'granted') await ps.register(REMINDER_TAG, { minInterval: 60 * 60 * 1000 });
    } else {
      await ps.unregister(REMINDER_TAG);
    }
  } catch {
    // Not available here; the in-app prompt still covers it.
  }
}

export function startReminders(): void {
  void syncReminders();
  document.addEventListener('visibilitychange', () => {
    void check();
    if (document.visibilityState === 'visible' && !pushConfigured()) void schedule();
  });
}
