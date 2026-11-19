/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { getEntry, getSettings, setSettings } from './db';
import { todayKey } from './lib/dates';
import { REMINDER_BODY, REMINDER_TAG, REMINDER_TITLE, reminderDue } from './lib/reminders';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> };
const sw = self;

// Offline: every built file is precached, and any navigation is answered with
// the app shell, so check-ins work with no connection.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void sw.skipWaiting();
});

/** Show today's reminder if it is due. Shared by periodic sync and page messages. */
async function maybeRemind(): Promise<void> {
  const settings = await getSettings();
  const today = todayKey();
  if (!reminderDue(settings, await getEntry(today))) return;
  await setSettings({ lastReminderDate: today });
  await sw.registration.showNotification(REMINDER_TITLE, {
    body: REMINDER_BODY,
    tag: REMINDER_TAG,
    icon: 'pwa-192x192.png',
    badge: 'badge-96x96.png',
    silent: false,
    data: { url: './#/checkin' },
  });
}

// Android Chrome (installed app): the browser wakes the worker now and then.
// Timing is up to the browser, so this is best effort.
sw.addEventListener('periodicsync', (event) => {
  const e = event as ExtendableEvent & { tag: string };
  if (e.tag === REMINDER_TAG) e.waitUntil(maybeRemind());
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? './#/checkin', sw.registration.scope).href;
  event.waitUntil(
    (async () => {
      const all = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('focus' in c) {
          await (c as WindowClient).navigate(url).catch(() => undefined);
          return void (await (c as WindowClient).focus());
        }
      }
      await sw.clients.openWindow(url);
    })(),
  );
});
