import { formatLong, formatRange, isDateKey } from './dates';
import type { Entry, Recap } from './types';
import { FIELD_LABELS, REFLECTION_FIELDS, STEPS } from './types';
import { applyPatch } from './entry';

export const EXPORT_FORMAT = 'mood-journal-export';
export const EXPORT_VERSION = 1;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  entries: Entry[];
  recaps: Recap[];
}

/** Settings (API key, PIN) are deliberately left out of exports. */
export function toExportJSON(entries: Entry[], recaps: Recap[], now = new Date()): string {
  const file: ExportFile = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    entries: [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    recaps: recaps.map(({ id: _id, ...r }) => r),
  };
  return JSON.stringify(file, null, 2);
}

const stepTitle = (key: string) => STEPS.find((s) => s.key === key)?.title ?? key;

export function toMarkdown(entries: Entry[], recaps: Recap[], now = new Date()): string {
  const out: string[] = ['# Journal', '', `Exported ${now.toISOString().slice(0, 10)}.`, ''];
  for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
    out.push(`## ${formatLong(e.date)}`, '');
    if (e.mood !== undefined || e.moodNote) {
      out.push(`**Mood** ${[e.mood !== undefined ? `${e.mood}/10` : '', e.moodNote ?? ''].filter(Boolean).join(' · ')}`, '');
    }
    for (const f of REFLECTION_FIELDS) {
      if (e[f]) out.push(`**${stepTitle(f)}**`, '', e[f]!, '');
    }
    if (e.practiced) out.push(`**Mindfulness practice** ${e.minutes ? `${e.minutes} min` : 'yes'}`, '');
  }
  if (recaps.length) {
    out.push('# Weekly recaps', '');
    for (const r of [...recaps].sort((a, b) => b.end.localeCompare(a.end))) {
      out.push(`## ${formatRange(r.start, r.end)} (${r.kind === 'ai' ? 'generated recap' : 'local summary'})`, '');
      const m = r.stats.mood;
      out.push(`- Average mood: ${m.average ?? '—'}`);
      if (m.highest) out.push(`- Highest: ${m.highest.mood} on ${formatLong(m.highest.date)}`);
      if (m.lowest) out.push(`- Lowest: ${m.lowest.mood} on ${formatLong(m.lowest.date)}`);
      out.push(`- Day by day: ${m.byDay.map((d) => d.mood ?? '–').join(', ')}`);
      out.push(`- Mindfulness: ${r.stats.mindfulness.daysPracticed} days, ${r.stats.mindfulness.totalMinutes} min`);
      if (r.ai) {
        for (const f of REFLECTION_FIELDS) {
          if (r.ai.themes[f]?.length) out.push(`- ${FIELD_LABELS[f]}: ${r.ai.themes[f].join('; ')}`);
        }
        for (const c of r.ai.changes) out.push(`- Change: ${c}`);
        for (const q of r.ai.questions) out.push(`- Question: ${q}`);
      }
      out.push('');
    }
  }
  return out.join('\n');
}

export interface ParsedImport {
  entries: Entry[];
  recaps: Recap[];
  skipped: number;
}

/** Validate an export file. Throws with a plain message when it is not one. */
export function parseImport(text: string): ParsedImport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const f = data as Partial<ExportFile>;
  if (!f || f.format !== EXPORT_FORMAT || !Array.isArray(f.entries)) {
    throw new Error('This does not look like a journal export.');
  }
  if (typeof f.version === 'number' && f.version > EXPORT_VERSION) {
    throw new Error('This export comes from a newer version of the app.');
  }

  let skipped = 0;
  const entries: Entry[] = [];
  for (const raw of f.entries as Partial<Entry>[]) {
    if (!raw || typeof raw.date !== 'string' || !isDateKey(raw.date)) {
      skipped++;
      continue;
    }
    const now = Date.now();
    const base: Entry = {
      date: raw.date,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
    };
    const clean = applyPatch(base, {
      mood: raw.mood,
      moodNote: str(raw.moodNote),
      thoughts: str(raw.thoughts),
      feelings: str(raw.feelings),
      response: str(raw.response),
      values: str(raw.values),
      practiced: raw.practiced === true ? true : undefined,
      minutes: typeof raw.minutes === 'number' ? raw.minutes : undefined,
      completedAt: typeof raw.completedAt === 'number' ? raw.completedAt : undefined,
    });
    entries.push(clean);
  }

  const recaps: Recap[] = [];
  for (const r of (Array.isArray(f.recaps) ? f.recaps : []) as Recap[]) {
    if (r && (r.kind === 'local' || r.kind === 'ai') && isDateKey(r.start) && isDateKey(r.end) && r.stats) {
      const { id: _id, ...rest } = r;
      recaps.push({ ...rest, seen: true });
    } else skipped++;
  }
  return { entries, recaps, skipped };
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
