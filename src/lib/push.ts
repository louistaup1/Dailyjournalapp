// Talks to the optional push server (worker/). The server only ever receives
// the push subscription, time zone, reminder/recap times, and the date of the
// last finished check-in. Never entry text, moods or recaps.

import { getEntry, getSettings, setSettings } from '../db';
import { todayKey } from './dates';
import type { Settings } from './types';

export const PUSH_URL: string = (import.meta.env.VITE_PUSH_URL ?? '').replace(/\/+$/, '');

export function pushConfigured(): boolean {
  return PUSH_URL !== '';
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function urlB64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function call(method: string, path: string, body: unknown): Promise<Response> {
  return fetch(PUSH_URL + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
}

async function token(s: Settings): Promise<string> {
  if (s.pushToken) return s.pushToken;
  const t = newToken();
  await setSettings({ pushToken: t });
  return t;
}

/** Get (or create) this device's push subscription. Needs notification permission. */
export async function getSubscription(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const res = await fetch(PUSH_URL + '/vapid-public-key', { credentials: 'omit' });
  if (!res.ok) throw new Error('The push server did not answer.');
  const { key } = (await res.json()) as { key: string };
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(key) });
}

/** Send the current schedule to the push server, or remove it when nothing is switched on. */
export async function syncPush(reg?: ServiceWorkerRegistration): Promise<'ok' | 'off' | 'unavailable' | 'error'> {
  if (!pushConfigured() || !('PushManager' in self)) return 'unavailable';
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return 'unavailable';
  const s = await getSettings();
  try {
    reg ??= await navigator.serviceWorker.ready;
    if (!s.reminderEnabled && !s.recapAuto) {
      if (s.pushToken) await call('DELETE', '/subscription', { token: s.pushToken });
      await (await reg.pushManager.getSubscription())?.unsubscribe();
      return 'off';
    }
    const sub = await getSubscription(reg);
    const today = todayKey();
    const done = (await getEntry(today))?.completedAt ? today : undefined;
    const res = await call('PUT', '/subscription', {
      token: await token(s),
      subscription: sub.toJSON(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      reminder: { enabled: s.reminderEnabled, time: s.reminderTime },
      recap: { enabled: s.recapAuto, weekday: s.recapWeekday, time: s.recapTime },
      doneDate: done,
    });
    return res.ok ? 'ok' : 'error';
  } catch (e) {
    console.warn('push sync failed', e);
    return 'error';
  }
}

/** Tell the server today's check-in is finished, so no reminder goes out. Sends only the date. */
export async function reportDone(date: string): Promise<void> {
  if (!pushConfigured()) return;
  const s = await getSettings();
  if (!s.pushToken || !s.reminderEnabled) return;
  await call('POST', '/done', { token: s.pushToken, date }).catch(() => undefined);
}

/** Ask the server to send a test push right now. */
export async function sendTestPush(): Promise<boolean> {
  const s = await getSettings();
  if (!pushConfigured() || !s.pushToken) return false;
  try {
    return (await call('POST', '/test', { token: s.pushToken })).ok;
  } catch {
    return false;
  }
}
