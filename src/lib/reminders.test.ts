import { describe, expect, it } from 'vitest';
import { reminderDue } from './reminders';
import { DEFAULT_SETTINGS } from './types';

const on = { ...DEFAULT_SETTINGS, reminderEnabled: true, reminderTime: '09:00' };
const at = (h: number, m = 0) => new Date(2026, 10, 19, h, m);

describe('reminderDue', () => {
  it('is off when reminders are disabled', () => {
    expect(reminderDue(DEFAULT_SETTINGS, undefined, at(10))).toBe(false);
  });
  it('waits for the set time', () => {
    expect(reminderDue(on, undefined, at(8, 59))).toBe(false);
    expect(reminderDue(on, undefined, at(9, 0))).toBe(true);
  });
  it('skips when today is done', () => {
    expect(reminderDue(on, { date: '2026-11-19', createdAt: 0, updatedAt: 0, completedAt: 1 }, at(10))).toBe(false);
  });
  it('still reminds when today is only started', () => {
    expect(reminderDue(on, { date: '2026-11-19', mood: 5, createdAt: 0, updatedAt: 0 }, at(10))).toBe(true);
  });
  it('reminds once a day', () => {
    expect(reminderDue({ ...on, lastReminderDate: '2026-11-19' }, undefined, at(10))).toBe(false);
    expect(reminderDue({ ...on, lastReminderDate: '2026-11-18' }, undefined, at(10))).toBe(true);
  });
});
