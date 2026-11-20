// The PIN is a privacy screen, not encryption: it keeps the journal from
// opening for someone holding an unlocked phone. Only a salted PBKDF2 hash is
// stored.

const ITERATIONS = 150_000;

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export function newSalt(): string {
  return b64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS },
    key,
    256,
  );
  return b64(bits);
}

export async function checkPin(pin: string, salt: string | undefined, hash: string | undefined): Promise<boolean> {
  if (!salt || !hash) return false;
  const h = await hashPin(pin, salt);
  // Length is fixed, so a plain comparison leaks nothing useful here.
  return h === hash;
}
