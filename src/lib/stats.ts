import type { DateKey, WeekRange } from './dates';
import type { Entry, ReflectionField, WeekStats } from './types';
import { REFLECTION_FIELDS } from './types';

/** Mean of the given moods, rounded to one decimal. Null when there are none. */
export function moodAverage(moods: number[]): number | null {
  if (moods.length === 0) return null;
  const sum = moods.reduce((a, b) => a + b, 0);
  return Math.round((sum / moods.length) * 10) / 10;
}

export function mindfulnessTotals(entries: Entry[]): { daysPracticed: number; totalMinutes: number } {
  let daysPracticed = 0;
  let totalMinutes = 0;
  for (const e of entries) {
    if (e.practiced) {
      daysPracticed++;
      totalMinutes += e.minutes && e.minutes > 0 ? e.minutes : 0;
    }
  }
  return { daysPracticed, totalMinutes };
}

/** Stats for one 7-day window. Entries outside the window are ignored. */
export function weekStats(week: WeekRange, entries: Entry[]): WeekStats {
  const byDate = new Map<DateKey, Entry>();
  for (const e of entries) if (week.days.includes(e.date)) byDate.set(e.date, e);
  const inWeek = [...byDate.values()];

  const byDay = week.days.map((date) => ({ date, mood: byDate.get(date)?.mood ?? null }));
  const rated = byDay.filter((d): d is { date: DateKey; mood: number } => d.mood !== null);

  // Highest/lowest: on ties, the earliest day wins.
  let highest: { date: DateKey; mood: number } | null = null;
  let lowest: { date: DateKey; mood: number } | null = null;
  for (const d of rated) {
    if (!highest || d.mood > highest.mood) highest = d;
    if (!lowest || d.mood < lowest.mood) lowest = d;
  }

  const counts = Object.fromEntries(REFLECTION_FIELDS.map((f) => [f, 0])) as Record<ReflectionField, number>;
  for (const e of inWeek) for (const f of REFLECTION_FIELDS) if (e[f]) counts[f]++;

  return {
    start: week.start,
    end: week.end,
    daysWithEntries: inWeek.length,
    mood: {
      count: rated.length,
      average: moodAverage(rated.map((d) => d.mood)),
      highest,
      lowest,
      byDay,
    },
    mindfulness: mindfulnessTotals(inWeek),
    counts,
  };
}

/** "the previous week" for 7 days, otherwise "the previous 14 days". */
export function previousLabel(s: WeekStats): string {
  const n = s.mood.byDay.length;
  return n === 7 ? 'the previous week' : `the previous ${n} days`;
}

/** Plain-language differences between this period and the one before it. */
export function compareWeeks(cur: WeekStats, prev: WeekStats | null): string[] {
  if (!prev || prev.daysWithEntries === 0) return [];
  const out: string[] = [];
  const label = previousLabel(cur);
  if (cur.mood.average !== null && prev.mood.average !== null) {
    const diff = Math.round((cur.mood.average - prev.mood.average) * 10) / 10;
    if (diff === 0) out.push(`Average mood was the same as ${label} (${cur.mood.average}).`);
    else
      out.push(
        `Average mood was ${cur.mood.average}, ${diff > 0 ? 'up' : 'down'} ${Math.abs(diff)} from ${prev.mood.average} ${label}.`,
      );
  }
  const a = cur.mindfulness;
  const b = prev.mindfulness;
  if (a.daysPracticed !== b.daysPracticed || a.totalMinutes !== b.totalMinutes) {
    out.push(
      `Mindfulness: ${a.daysPracticed} ${a.daysPracticed === 1 ? 'day' : 'days'} and ${a.totalMinutes} min, compared with ${b.daysPracticed} ${b.daysPracticed === 1 ? 'day' : 'days'} and ${b.totalMinutes} min.`,
    );
  }
  if (cur.daysWithEntries !== prev.daysWithEntries) {
    out.push(`Days with entries: ${cur.daysWithEntries}, compared with ${prev.daysWithEntries}.`);
  }
  return out;
}
