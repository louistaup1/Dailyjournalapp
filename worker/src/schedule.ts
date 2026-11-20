// Decides when to send. Pure functions, so they can be tested without a Worker.

export interface Schedule {
  timeZone: string; // IANA, e.g. "Europe/Paris"
  reminder: { enabled: boolean; time: string }; // "HH:MM"
  recap: { enabled: boolean; weekday: number; time: string }; // 0 = Sunday
}

export interface SubRecord extends Schedule {
  subscription: { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string } };
  /** Local date ("YYYY-MM-DD") of the last finished check-in. No content. */
  doneDate?: string;
  lastReminderDate?: string;
  lastRecapDate?: string;
  createdAt: number;
  updatedAt: number;
}

export type PushKind = 'reminder' | 'recap';

/** A send only happens within this long after the set time, so a late cron or a new subscription doesn't fire hours late. */
export const WINDOW_MINUTES = 180;

export interface LocalNow {
  date: string;
  weekday: number;
  minutes: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function localNow(now: Date, timeZone: string): LocalNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS.indexOf(parts.weekday),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function parseTime(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function inWindow(nowMinutes: number, hhmm: string): boolean {
  const t = parseTime(hhmm);
  return t !== null && nowMinutes >= t && nowMinutes < t + WINDOW_MINUTES;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Which pushes are due for this subscription right now. */
export function duePushes(rec: SubRecord, now: Date): PushKind[] {
  const local = localNow(now, rec.timeZone);
  const out: PushKind[] = [];
  if (
    rec.reminder.enabled &&
    inWindow(local.minutes, rec.reminder.time) &&
    rec.doneDate !== local.date &&
    rec.lastReminderDate !== local.date
  ) {
    out.push('reminder');
  }
  if (
    rec.recap.enabled &&
    local.weekday === rec.recap.weekday &&
    inWindow(local.minutes, rec.recap.time) &&
    rec.lastRecapDate !== local.date
  ) {
    out.push('recap');
  }
  return out;
}
