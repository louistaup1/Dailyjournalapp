import { describe, expect, it } from 'vitest';
import { checkPin, hashPin, isValidPin, newSalt } from './pin';

describe('pin', () => {
  it('accepts 4 to 8 digits', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('12345678')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });
  it('hashes with a salt and verifies', async () => {
    const salt = newSalt();
    const h = await hashPin('2468', salt);
    expect(h).not.toContain('2468');
    expect(await checkPin('2468', salt, h)).toBe(true);
    expect(await checkPin('2469', salt, h)).toBe(false);
    expect(await hashPin('2468', newSalt())).not.toBe(h);
  });
});
