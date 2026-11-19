import { db, entriesBetween, getSettings, setSettings } from './db';
import { lastScheduledRecapDay, previousWeek, todayKey, weekEndingOn, type DateKey } from './lib/dates';
import { buildRecapPrompt } from './lib/recapPrompt';

import { weekStats } from './lib/stats';
import type { Recap } from './lib/types';

async function weekData(end: DateKey) {
  const week = weekEndingOn(end);
  const prev = previousWeek(week);
  const entries = await entriesBetween(prev.start, week.end);
  const stats = weekStats(week, entries);
  const prevStats = weekStats(prev, entries);
  return { entries, stats, previous: prevStats.daysWithEntries ? prevStats : null };
}

/** Stats-only summary. Makes no network request. */
export async function createLocalRecap(end: DateKey = todayKey(), auto = false): Promise<number> {
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
  };
  return (await db.recaps.add(recap)) as number;
}

/** Sends the week's entries (and the previous week's, for comparison) to the Anthropic API. */
export async function createAiRecap(end: DateKey = todayKey()): Promise<number> {
  const settings = await getSettings();
  if (!settings.apiKey) throw new Error('Add an Anthropic API key in Settings first.');
  const { entries, stats, previous } = await weekData(end);
  const prompt = buildRecapPrompt({ stats, entries }, previous ? { stats: previous, entries } : null);
  // Loaded on demand so the SDK isn't part of the everyday app bundle.
  const { requestAiRecap } = await import('./lib/recapApi');
  const ai = await requestAiRecap(settings.apiKey, prompt);
  const recap: Recap = { kind: 'ai', start: stats.start, end: stats.end, createdAt: Date.now(), auto: false, stats, previous, ai, seen: true };
  return (await db.recaps.add(recap)) as number;
}

/**
 * On the scheduled evening (Sunday 19:00 by default), make a local summary for
 * the week ending that day, once. Automatic recaps never call the API: entries
 * leave the device only when "Generate recap" is tapped.
 */
export async function runAutoRecap(now = new Date()): Promise<void> {
  const s = await getSettings();
  if (!s.recapAuto) return;
  const end = lastScheduledRecapDay(s.recapWeekday, s.recapTime, now);
  // Once per scheduled week, even if that summary is later deleted.
  if (s.lastAutoRecapEnd && s.lastAutoRecapEnd >= end) return;
  await setSettings({ lastAutoRecapEnd: end });
  if (await db.recaps.where('end').equals(end).count()) return;
  // Only weeks with something written in them.
  const { stats } = await weekData(end);
  if (!stats.daysWithEntries) return;
  await createLocalRecap(end, true);
}

export function markSeen(id: number) {
  return db.recaps.update(id, { seen: true });
}

export function deleteRecap(id: number) {
  return db.recaps.delete(id);
}
