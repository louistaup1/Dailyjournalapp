import { db, entriesBetween, getSettings, setSettings } from './db';
import {
  addDays,
  daysBetween,
  lastScheduledRecapDay,
  MAX_RECAP_DAYS,
  previousRange,
  rangeOf,
  todayKey,
  weekEndingOn,
  type DateKey,
} from './lib/dates';
import { buildRecapPrompt } from './lib/recapPrompt';
import { weekStats } from './lib/stats';
import type { Recap } from './lib/types';
import type { Period } from './lib/periods';
import type { requestAiRecap } from './lib/recapApi';

type Requester = typeof requestAiRecap;
let loadRequester: (() => Promise<Requester>) | null = null;

/**
 * How to reach the Anthropic API. The page loads the SDK lazily; the service
 * worker can't use dynamic imports, so it passes the function in directly.
 */
export function setRecapRequester(load: () => Promise<Requester>): void {
  loadRequester = load;
}

/** The last 7 days, ending today. */
export const lastWeek = (end: DateKey = todayKey()): Period => weekEndingOn(end);

/**
 * Stats for a period and for the same number of days just before it. Periods
 * longer than MAX_RECAP_DAYS are cut to their most recent days.
 */
async function periodData(period: Period) {
  let { start } = period;
  if (daysBetween(start, period.end) + 1 > MAX_RECAP_DAYS) start = addDays(period.end, -(MAX_RECAP_DAYS - 1));
  const range = rangeOf(start, period.end);
  if (!range.days.length) throw new Error('That period has no days in it.');
  const prev = previousRange(range);
  const entries = await entriesBetween(prev.start, range.end);
  const stats = weekStats(range, entries);
  const prevStats = weekStats(prev, entries);
  return { entries, stats, previous: prevStats.daysWithEntries ? prevStats : null };
}

/** Stats-only summary. Makes no network request. */
export async function createLocalRecap(period: Period = lastWeek(), auto = false, note?: string): Promise<number> {
  const { stats, previous } = await periodData(period);
  const recap: Recap = {
    kind: 'local',
    start: stats.start,
    end: stats.end,
    createdAt: Date.now(),
    auto,
    stats,
    previous,
    seen: !auto,
    ...(note ? { note } : {}),
  };
  return (await db.recaps.add(recap)) as number;
}

/** Sends the period's entries (and the same number of days before it, for comparison) to the Anthropic API. */
export async function createAiRecap(period: Period = lastWeek(), auto = false): Promise<number> {
  const settings = await getSettings();
  if (!settings.apiKey) throw new Error('Add an Anthropic API key in Settings first.');
  const { entries, stats, previous } = await periodData(period);
  const prompt = buildRecapPrompt({ stats, entries }, previous ? { stats: previous, entries } : null);
  if (!loadRequester) throw new Error('Recap generation is not available here.');
  const request = await loadRequester();
  const ai = await request(settings.apiKey, prompt);
  const recap: Recap = { kind: 'ai', start: stats.start, end: stats.end, createdAt: Date.now(), auto, stats, previous, ai, seen: !auto };
  return (await db.recaps.add(recap)) as number;
}

/** The last day covered by any saved recap, or null when there are none. */
export async function lastRecapEnd(): Promise<DateKey | null> {
  const last = await db.recaps.orderBy('end').last();
  return last?.end ?? null;
}

export type AutoResult = { id: number; recap: Recap } | { id: null; reason: 'off' | 'done' | 'empty' };

/**
 * On the scheduled evening (Sunday 19:00 by default), make the recap for the
 * week ending that day, once. With an API key saved, this sends the week's
 * entries to Anthropic for a written recap; without one, or if that fails, it
 * saves a local summary. Runs when the app opens, and from the service worker
 * when the push server's weekly push arrives, even with the app closed.
 */
export async function runAutoRecap(now = new Date()): Promise<AutoResult> {
  const s = await getSettings();
  if (!s.recapAuto) return { id: null, reason: 'off' };
  const end = lastScheduledRecapDay(s.recapWeekday, s.recapTime, now);
  // Once per scheduled week, even if that recap is later deleted.
  if (s.lastAutoRecapEnd && s.lastAutoRecapEnd >= end) return { id: null, reason: 'done' };
  await setSettings({ lastAutoRecapEnd: end });
  const week = lastWeek(end);
  // An ad hoc recap of exactly this week counts; one for another period doesn't.
  if (await db.recaps.where('end').equals(end).filter((r) => r.start === week.start).count()) return { id: null, reason: 'done' };
  const { stats } = await periodData(week);
  if (!stats.daysWithEntries) return { id: null, reason: 'empty' };

  let id: number;
  if (s.apiKey) {
    try {
      id = await createAiRecap(week, true);
    } catch (e) {
      id = await createLocalRecap(week, true, `The written recap couldn't be made: ${(e as Error).message}`);
    }
  } else {
    id = await createLocalRecap(week, true);
  }
  return { id, recap: (await db.recaps.get(id))! };
}

export function markSeen(id: number) {
  return db.recaps.update(id, { seen: true });
}

export function deleteRecap(id: number) {
  return db.recaps.delete(id);
}
