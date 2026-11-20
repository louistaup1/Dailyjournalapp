import { db, entriesBetween, getSettings, setSettings } from './db';
import { lastScheduledRecapDay, previousWeek, todayKey, weekEndingOn, type DateKey } from './lib/dates';
import { buildRecapPrompt } from './lib/recapPrompt';

import { weekStats } from './lib/stats';
import type { Recap } from './lib/types';
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

async function weekData(end: DateKey) {
  const week = weekEndingOn(end);
  const prev = previousWeek(week);
  const entries = await entriesBetween(prev.start, week.end);
  const stats = weekStats(week, entries);
  const prevStats = weekStats(prev, entries);
  return { entries, stats, previous: prevStats.daysWithEntries ? prevStats : null };
}

/** Stats-only summary. Makes no network request. */
export async function createLocalRecap(end: DateKey = todayKey(), auto = false, note?: string): Promise<number> {
  const { stats, previous } = await weekData(end);
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

/** Sends the week's entries (and the previous week's, for comparison) to the Anthropic API. */
export async function createAiRecap(end: DateKey = todayKey(), auto = false): Promise<number> {
  const settings = await getSettings();
  if (!settings.apiKey) throw new Error('Add an Anthropic API key in Settings first.');
  const { entries, stats, previous } = await weekData(end);
  const prompt = buildRecapPrompt({ stats, entries }, previous ? { stats: previous, entries } : null);
  if (!loadRequester) throw new Error('Recap generation is not available here.');
  const request = await loadRequester();
  const ai = await request(settings.apiKey, prompt);
  const recap: Recap = { kind: 'ai', start: stats.start, end: stats.end, createdAt: Date.now(), auto, stats, previous, ai, seen: !auto };
  return (await db.recaps.add(recap)) as number;
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
  if (await db.recaps.where('end').equals(end).count()) return { id: null, reason: 'done' };
  const { stats } = await weekData(end);
  if (!stats.daysWithEntries) return { id: null, reason: 'empty' };

  let id: number;
  if (s.apiKey) {
    try {
      id = await createAiRecap(end, true);
    } catch (e) {
      id = await createLocalRecap(end, true, `The written recap couldn't be made: ${(e as Error).message}`);
    }
  } else {
    id = await createLocalRecap(end, true);
  }
  return { id, recap: (await db.recaps.get(id))! };
}

export function markSeen(id: number) {
  return db.recaps.update(id, { seen: true });
}

export function deleteRecap(id: number) {
  return db.recaps.delete(id);
}
