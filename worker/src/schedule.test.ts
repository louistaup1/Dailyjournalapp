import { describe, expect, it } from 'vitest';
import { duePushes, localNow, type SubRecord } from './schedule';

const rec = (over: Partial<SubRecord> = {}): SubRecord => ({
  timeZone: 'Europe/Paris',
  reminder: { enabled: true, time: '09:00' },
  recap: { enabled: true, weekday: 0, time: '19:00' },
  subscription: { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' } },
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

// Thursday 19 Nov 2026. Paris is UTC+1 in November.
const utc = (h: number, m = 0, day = 19) => new Date(Date.UTC(2026, 10, day, h, m));

describe('localNow', () => {
  it('uses the subscriber time zone', () => {
    expect(localNow(utc(8, 5), 'Europe/Paris')).toEqual({ date: '2026-11-19', weekday: 4, minutes: 9 * 60 + 5 });
    expect(localNow(utc(2), 'America/Los_Angeles')).toEqual({ date: '2026-11-18', weekday: 3, minutes: 18 * 60 });
  });
});

describe('duePushes', () => {
  it('reminds at the local time, not before', () => {
    expect(duePushes(rec(), utc(7, 55))).toEqual([]);
    expect(duePushes(rec(), utc(8, 0))).toEqual(['reminder']);
  });
  it('does not remind when today is done or already reminded', () => {
    expect(duePushes(rec({ doneDate: '2026-11-19' }), utc(8, 5))).toEqual([]);
    expect(duePushes(rec({ lastReminderDate: '2026-11-19' }), utc(8, 5))).toEqual([]);
    expect(duePushes(rec({ doneDate: '2026-11-18' }), utc(8, 5))).toEqual(['reminder']);
  });
  it('does not send hours late', () => {
    expect(duePushes(rec(), utc(12, 0))).toEqual([]); // 13:00 Paris, past the 3 h window
  });
  it('respects the toggle', () => {
    expect(duePushes(rec({ reminder: { enabled: false, time: '09:00' } }), utc(8, 5))).toEqual([]);
  });
  it('sends the recap on the chosen evening, once', () => {
    const sunday = utc(18, 0, 22); // Sunday 19:00 Paris
    expect(duePushes(rec({ doneDate: '2026-11-22' }), sunday)).toEqual(['recap']);
    expect(duePushes(rec({ doneDate: '2026-11-22', lastRecapDate: '2026-11-22' }), sunday)).toEqual([]);
    expect(duePushes(rec(), utc(18, 0, 21))).toEqual([]); // Saturday
  });
});
