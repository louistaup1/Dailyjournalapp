// Dates are stored as local calendar keys ("YYYY-MM-DD") so an entry belongs to
// the day it was written on, in the phone's own time zone. All arithmetic goes
// through local Date objects at noon to stay clear of DST edges.

export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function isDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = fromDateKey(s);
  return toDateKey(d) === s;
}

/** Local noon on the given day. */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: DateKey, b: DateKey): number {
  const ms = fromDateKey(b).getTime() - fromDateKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** The n days ending on (and including) endKey, oldest first. */
export function lastNDays(endKey: DateKey, n: number): DateKey[] {
  const out: DateKey[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endKey, -i));
  return out;
}

export interface WeekRange {
  start: DateKey;
  end: DateKey;
  days: DateKey[];
}

/** The 7-day window ending on endKey, inclusive. */
export function weekEndingOn(endKey: DateKey): WeekRange {
  const days = lastNDays(endKey, 7);
  return { start: days[0], end: endKey, days };
}

/** Every day from start to end, inclusive. */
export function rangeOf(start: DateKey, end: DateKey): WeekRange {
  const n = daysBetween(start, end) + 1;
  return { start, end, days: n > 0 ? lastNDays(end, n) : [] };
}

/** The window of the same length immediately before the given one. */
export function previousRange(range: WeekRange): WeekRange {
  const end = addDays(range.start, -1);
  return rangeOf(addDays(end, -(range.days.length - 1)), end);
}

/** The 7-day window immediately before the given one. */
export function previousWeek(week: WeekRange): WeekRange {
  return previousRange(week);
}

/** The longest period a recap can cover. */
export const MAX_RECAP_DAYS = 31;

export function weekdayOf(key: DateKey): number {
  return fromDateKey(key).getDay();
}

/** "HH:MM" -> minutes after midnight. Invalid input returns null. */
export function parseTime(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** The next local moment at hh:mm strictly after `now`. */
export function nextOccurrence(hhmm: string, now: Date = new Date()): Date {
  const mins = parseTime(hhmm) ?? 9 * 60;
  const d = new Date(now);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** Whether `now` is at or past hh:mm on its own calendar day. */
export function isPastTimeToday(hhmm: string, now: Date = new Date()): boolean {
  const mins = parseTime(hhmm);
  if (mins === null) return false;
  return now.getHours() * 60 + now.getMinutes() >= mins;
}

/**
 * The most recent scheduled recap moment (weekday + time) at or before `now`,
 * returned as the date key of that weekday. Used to decide whether an automatic
 * recap is due.
 */
export function lastScheduledRecapDay(weekday: number, hhmm: string, now: Date = new Date()): DateKey {
  const today = toDateKey(now);
  const back = (weekdayOf(today) - weekday + 7) % 7;
  if (back === 0 && !isPastTimeToday(hhmm, now)) return addDays(today, -7);
  return addDays(today, -back);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayName(n: number): string {
  return WEEKDAYS[n] ?? '';
}

/** "Tue 17 Nov" */
export function formatShort(key: DateKey): string {
  const d = fromDateKey(key);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "Tuesday 17 Nov 2026" */
export function formatLong(key: DateKey): string {
  const d = fromDateKey(key);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "17–23 Nov" or "28 Nov – 4 Dec" */
export function formatRange(start: DateKey, end: DateKey): string {
  const a = fromDateKey(start);
  const b = fromDateKey(end);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
  return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
}
