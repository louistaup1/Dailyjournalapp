import { describe, expect, it, vi, beforeEach } from 'vitest';
import worker, { runSchedule, type Env } from './index';

// ---------- a fake KV ----------
function fakeKV() {
  const m = new Map<string, string>();
  return {
    map: m,
    async get(k: string, type?: string) {
      const v = m.get(k);
      return v === undefined ? null : type === 'json' ? JSON.parse(v) : v;
    },
    async put(k: string, v: string) {
      m.set(k, v);
    },
    async delete(k: string) {
      m.delete(k);
    },
    async list({ prefix }: { prefix: string }) {
      return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
    },
  };
}

const b64u = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64url');
const fromB64u = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

/** RFC 8291 decryption, as the browser does it. */
async function decrypt(body: Uint8Array, client: CryptoKeyPair, clientPub: Uint8Array, auth: Uint8Array) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const serverPub = body.slice(21, 21 + idlen);
  const ct = body.slice(21 + idlen);
  const serverKey = await crypto.subtle.importKey('raw', serverPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: serverKey }, client.privateKey, 256));
  const enc = new TextEncoder();
  const keyInfo = new Uint8Array([...enc.encode('WebPush: info\0'), ...clientPub, ...serverPub]);
  const ikm = await hkdf(auth, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, ct));
  let end = plain.length - 1;
  while (plain[end] === 0) end--; // strip padding; delimiter is 0x02
  return new TextDecoder().decode(plain.slice(0, end));
}

let env: Env & { SUBS: ReturnType<typeof fakeKV> };
let client: CryptoKeyPair;
let clientPub: Uint8Array;
let auth: Uint8Array;
let vapidPub: CryptoKey;
const sent: { url: string; init: RequestInit }[] = [];
const token = 'a'.repeat(43);
const origin = 'https://journal.example';

beforeEach(async () => {
  sent.length = 0;
  const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  vapidPub = vapid.publicKey;
  client = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  clientPub = new Uint8Array(await crypto.subtle.exportKey('raw', client.publicKey));
  auth = crypto.getRandomValues(new Uint8Array(16));
  env = {
    SUBS: fakeKV(),
    ALLOWED_ORIGIN: origin,
    VAPID_SUBJECT: 'mailto:test@example.com',
    VAPID_PUBLIC_KEY: b64u(await crypto.subtle.exportKey('raw', vapid.publicKey)),
    VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', vapid.privateKey)).d!,
  } as never;
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return new Response(null, { status: 201 });
  });
});

const call = (method: string, path: string, body?: unknown) =>
  worker.fetch(new Request(`https://push.example${path}`, { method, body: body ? JSON.stringify(body) : undefined }), env);

const subscribe = (over: Record<string, unknown> = {}) =>
  call('PUT', '/subscription', {
    token,
    timeZone: 'Europe/Paris',
    reminder: { enabled: true, time: '09:00' },
    recap: { enabled: true, weekday: 0, time: '19:00' },
    subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64u(clientPub), auth: b64u(auth) } },
    ...over,
  });

describe('push server', () => {
  it('stores a subscription under a hash of the token, never the token', async () => {
    expect((await subscribe()).status).toBe(200);
    const [k] = [...env.SUBS.map.keys()];
    expect(k).toMatch(/^sub:[0-9a-f]{64}$/);
    expect(env.SUBS.map.get(k)).not.toContain(token);
  });

  it('rejects bad input', async () => {
    expect((await subscribe({ timeZone: 'Mars/Base' })).status).toBe(400);
    expect((await subscribe({ token: 'short' })).status).toBe(400);
    expect((await subscribe({ subscription: { endpoint: 'http://x', keys: { p256dh: 'a', auth: 'b' } } })).status).toBe(400);
  });

  it('sets CORS for the app origin', async () => {
    const r = await call('OPTIONS', '/subscription');
    expect(r.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('sends an encrypted, signed reminder at the set time, once', async () => {
    await subscribe();
    await runSchedule(env, new Date(Date.UTC(2026, 10, 19, 8, 5))); // 09:05 Paris
    expect(sent).toHaveLength(1);
    const { url, init } = sent[0];
    expect(url).toBe('https://fcm.googleapis.com/fcm/send/abc');
    const h = init.headers as Record<string, string>;
    expect(h['content-encoding']).toBe('aes128gcm');

    // VAPID JWT is signed by our key and addressed to the push service.
    const [, t] = /t=([^,]+)/.exec(h.authorization)!;
    const [hdr, claims, sig] = t.split('.');
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vapidPub, fromB64u(sig), new TextEncoder().encode(`${hdr}.${claims}`));
    expect(ok).toBe(true);
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toMatchObject({ aud: 'https://fcm.googleapis.com' });

    // The phone can decrypt it, and it says only which notification to show.
    const plain = await decrypt(new Uint8Array(init.body as ArrayBuffer), client, clientPub, auth);
    expect(JSON.parse(plain)).toEqual({ type: 'reminder' });

    await runSchedule(env, new Date(Date.UTC(2026, 10, 19, 8, 10)));
    expect(sent).toHaveLength(1);
  });

  it('skips the reminder once today is done', async () => {
    await subscribe();
    await call('POST', '/done', { token, date: '2026-11-19' });
    await runSchedule(env, new Date(Date.UTC(2026, 10, 19, 8, 5)));
    expect(sent).toHaveLength(0);
  });

  it('sends the weekly recap push', async () => {
    await subscribe({ reminder: { enabled: false, time: '09:00' } });
    await runSchedule(env, new Date(Date.UTC(2026, 10, 22, 18, 0))); // Sunday 19:00 Paris
    expect(sent).toHaveLength(1);
    const plain = await decrypt(new Uint8Array(sent[0].init.body as ArrayBuffer), client, clientPub, auth);
    expect(JSON.parse(plain)).toEqual({ type: 'recap' });
  });

  it('drops subscriptions the push service says are gone', async () => {
    await subscribe();
    vi.stubGlobal('fetch', async () => new Response(null, { status: 410 }));
    await runSchedule(env, new Date(Date.UTC(2026, 10, 19, 8, 5)));
    expect(env.SUBS.map.size).toBe(0);
  });

  it('deletes on request', async () => {
    await subscribe();
    await call('DELETE', '/subscription', { token });
    expect(env.SUBS.map.size).toBe(0);
  });
});
