/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { getEntry, getSettings, setSettings } from './db';
import { todayKey } from './lib/dates';
import { formatRange } from './lib/dates';
import { REMINDER_BODY, REMINDER_TAG, REMINDER_TITLE, reminderDue } from './lib/reminders';
import { syncPush } from './lib/push';
import { requestAiRecap } from './lib/recapApi';
import { runAutoRecap, setRecapRequester } from './recaps';

setRecapRequester(async () => requestAiRecap);

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

// ---------- push from the push server (works with the app closed) ----------

const notify = (body: string, url: string, tag: string) =>
  sw.registration.showNotification(REMINDER_TITLE, { body, tag, icon: 'pwa-192x192.png', badge: 'badge-96x96.png', data: { url } });

async function onPush(type: string): Promise<void> {
  if (type === 'test') return notify('This is how the daily reminder will look.', './#/checkin', REMINDER_TAG);

  if (type === 'reminder') {
    const today = todayKey();
    const entry = await getEntry(today);
    // The server skips days already reported done; this covers a check-in
    // finished offline. Showing nothing is rare and only happens then.
    if (entry?.completedAt) return;
    await setSettings({ lastReminderDate: today });
    return notify(REMINDER_BODY, './#/checkin', REMINDER_TAG);
  }

  if (type === 'recap') {
    const res = await runAutoRecap().catch(() => null);
    if (res && res.id !== null) {
      const r = res.recap;
      const body = r.kind === 'ai' ? `Your recap for ${formatRange(r.start, r.end)} is ready.` : `A summary of ${formatRange(r.start, r.end)} is ready.`;
      return notify(body, `./#/recap/${res.id}`, 'weekly-recap');
    }
    if (res?.reason === 'empty') return notify('Nothing was written this week, so there is no recap.', './#/recaps', 'weekly-recap');
    // Already made, or turned off: say nothing new, but a push must show something.
    return notify('Your weekly recap is in the app.', './#/recaps', 'weekly-recap');
  }
}

sw.addEventListener('push', (event) => {
  let type = 'reminder';
  try {
    type = (event.data?.json() as { type?: string })?.type ?? 'reminder';
  } catch {
    // keep the default
  }
  event.waitUntil(onPush(type));
});

// The browser rotated the subscription: hand the new one to the server.
sw.addEventListener('pushsubscriptionchange', (event) => {
  (event as ExtendableEvent).waitUntil(syncPush(sw.registration).then(() => undefined));
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
