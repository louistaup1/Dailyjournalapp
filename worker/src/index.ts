// Push server for the journal app.
//
// It stores, per device: the browser's push subscription, a time zone, the
// reminder and recap times, and the date of the last finished check-in (so it
// doesn't remind on days that are already done). It never receives journal
// text, moods or recaps. Push payloads are encrypted end to end (RFC 8291)
// and only say which kind of notification to show.

import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push';
import { duePushes, isValidTimeZone, localNow, parseTime, type PushKind, type Schedule, type SubRecord } from './schedule';

export interface Env {
  SUBS: KVNamespace;
  ALLOWED_ORIGIN: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

const TTL: Record<PushKind | 'test', number> = { reminder: 6 * 3600, recap: 24 * 3600, test: 600 };

// ---------- helpers ----------

function cors(env: Env): Record<string, string> {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function json(env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(env) } });
}

async function keyFor(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return 'sub:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const isToken = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(t);
const isDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

function validSchedule(b: Record<string, unknown>): Schedule | null {
  const r = b.reminder as Schedule['reminder'] | undefined;
  const c = b.recap as Schedule['recap'] | undefined;
  if (typeof b.timeZone !== 'string' || !isValidTimeZone(b.timeZone)) return null;
  if (!r || typeof r.enabled !== 'boolean' || parseTime(r.time) === null) return null;
  if (!c || typeof c.enabled !== 'boolean' || parseTime(c.time) === null) return null;
  if (!Number.isInteger(c.weekday) || c.weekday < 0 || c.weekday > 6) return null;
  return {
    timeZone: b.timeZone,
    reminder: { enabled: r.enabled, time: r.time },
    recap: { enabled: c.enabled, weekday: c.weekday, time: c.time },
  };
}

function validSubscription(s: unknown): SubRecord['subscription'] | null {
  const sub = s as SubRecord['subscription'];
  if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || sub.endpoint.length > 2000) return null;
  if (!sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string') return null;
  return { endpoint: sub.endpoint, expirationTime: sub.expirationTime ?? null, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
}

/** Send one push. Returns false when the subscription is gone and should be dropped. */
async function send(env: Env, rec: SubRecord, kind: PushKind | 'test'): Promise<boolean> {
  const payload = await buildPushPayload(
    { data: JSON.stringify({ type: kind }), options: { ttl: TTL[kind], urgency: 'normal', topic: kind } },
    rec.subscription as PushSubscription,
    { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
  );
  const res = await fetch(rec.subscription.endpoint, payload);
  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) console.warn(`push ${kind} failed: ${res.status}`);
  return true;
}

// ---------- HTTP ----------

async function handle(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
  const url = new URL(req.url);

  if (req.method === 'GET' && url.pathname === '/vapid-public-key') {
    return json(env, { key: env.VAPID_PUBLIC_KEY });
  }

  if (req.headers.get('content-length') && Number(req.headers.get('content-length')) > 8192) {
    return json(env, { error: 'too large' }, 413);
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(env, { error: 'bad json' }, 400);
  }
  if (!isToken(body.token)) return json(env, { error: 'bad token' }, 400);
  const key = await keyFor(body.token);

  // Create or update this device's subscription and schedule.
  if (req.method === 'PUT' && url.pathname === '/subscription') {
    const schedule = validSchedule(body);
    const subscription = validSubscription(body.subscription);
    if (!schedule || !subscription) return json(env, { error: 'bad subscription or schedule' }, 400);
    const prev = await env.SUBS.get<SubRecord>(key, 'json');
    const now = Date.now();
    const rec: SubRecord = {
      ...prev,
      ...schedule,
      subscription,
      doneDate: isDate(body.doneDate) ? body.doneDate : prev?.doneDate,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    await env.SUBS.put(key, JSON.stringify(rec));
    return json(env, { ok: true });
  }

  // Today's check-in is finished: skip today's reminder.
  if (req.method === 'POST' && url.pathname === '/done') {
    if (!isDate(body.date)) return json(env, { error: 'bad date' }, 400);
    const rec = await env.SUBS.get<SubRecord>(key, 'json');
    if (!rec) return json(env, { error: 'not found' }, 404);
    if (rec.doneDate !== body.date) await env.SUBS.put(key, JSON.stringify({ ...rec, doneDate: body.date, updatedAt: Date.now() }));
    return json(env, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/test') {
    const rec = await env.SUBS.get<SubRecord>(key, 'json');
    if (!rec) return json(env, { error: 'not found' }, 404);
    const alive = await send(env, rec, 'test');
    if (!alive) await env.SUBS.delete(key);
    return json(env, { ok: alive }, alive ? 200 : 410);
  }

  if (req.method === 'DELETE' && url.pathname === '/subscription') {
    await env.SUBS.delete(key);
    return json(env, { ok: true });
  }

  return json(env, { error: 'not found' }, 404);
}

// ---------- cron ----------

export async function runSchedule(env: Env, now = new Date()): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await env.SUBS.list({ prefix: 'sub:', cursor });
    for (const { name } of page.keys) {
      const rec = await env.SUBS.get<SubRecord>(name, 'json');
      if (!rec) continue;
      const due = duePushes(rec, now);
      if (!due.length) continue;
      const today = localNow(now, rec.timeZone).date;
      let alive = true;
      for (const kind of due) {
        try {
          alive = await send(env, rec, kind);
        } catch (e) {
          console.warn('push error', e);
        }
        if (!alive) break;
        if (kind === 'reminder') rec.lastReminderDate = today;
        if (kind === 'recap') rec.lastRecapDate = today;
      }
      if (alive) await env.SUBS.put(name, JSON.stringify(rec));
      else await env.SUBS.delete(name);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

export default {
  fetch: (req: Request, env: Env) =>
    handle(req, env).catch((e) => {
      console.error(e);
      return json(env, { error: 'server error' }, 500);
    }),
  scheduled: (_event: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runSchedule(env));
  },
} satisfies ExportedHandler<Env>;
