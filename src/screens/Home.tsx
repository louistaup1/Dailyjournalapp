import { useState } from 'react';
import { allEntries, allRecaps, getEntry } from '../db';
import { addDays, daysBetween, formatRange, formatShort, todayKey } from '../lib/dates';
import { navigate } from '../lib/router';
import { useLive } from '../lib/useLive';
import type { Entry } from '../lib/types';
import { Footer } from '../components/Footer';

const PAGE = 30;

function describe(e: Entry): string {
  const parts: string[] = [];
  if (e.mood !== undefined) parts.push(`mood ${e.mood}`);
  if (e.practiced) parts.push(e.minutes ? `${e.minutes} min practice` : 'practiced');
  if (!parts.length) parts.push('notes');
  return parts.join(' · ');
}

export function Home() {
  const today = todayKey();
  const entry = useLive(() => getEntry(today), [today]);
  const entries = useLive(allEntries, []);
  const recaps = useLive(allRecaps, []);
  const [shown, setShown] = useState(PAGE);

  if (!entries) return <div className="page" />;

  const done = !!entry?.completedAt;
  const fresh = recaps?.find((r) => !r.seen);
  const started = !!entry && !done;
  const byDate = new Map(entries.map((e) => [e.date, e]));

  // Past days: every calendar day back to the earliest entry (at least a week),
  // missed days shown as plain dates.
  const earliest = entries[0]?.date;
  const span = Math.max(7, earliest ? daysBetween(earliest, today) : 0);
  const visible = Math.min(span, shown);
  const days = Array.from({ length: visible }, (_, i) => addDays(today, -(i + 1)));

  return (
    <div className="page">
      <div className="topbar">
        <span className="faint small">Journal</span>
        <button className="link" onClick={() => navigate('/settings')}>
          Settings
        </button>
      </div>

      <div className="grow">
        {fresh && (
          <p className="notice muted">
            A summary of {formatRange(fresh.start, fresh.end)} is ready.{' '}
            <button className="link inline" onClick={() => navigate(`/recap/${fresh.id}`)}>
              Read it
            </button>
          </p>
        )}
        <section aria-label="Today">
          {done ? (
            <p>
              Done for today{entry?.mood !== undefined ? ` · mood ${entry.mood}/10` : ''}.{' '}
              <button className="link inline" onClick={() => navigate(`/day/${today}`)}>
                View or edit
              </button>
            </p>
          ) : (
            <>
              <p className="notice muted">
                {started ? "You started today's check-in. You can pick it up where you left off." : "Today's check-in is here whenever you're ready."}
              </p>
              <button className="btn block" onClick={() => navigate(`/checkin/${today}/0`)}>
                {started ? "Continue today's check-in" : "Start today's check-in"}
              </button>
            </>
          )}
        </section>

        <p style={{ marginTop: '1.25rem', marginBottom: 0 }}>
          <button className="link" style={{ paddingLeft: 0 }} onClick={() => navigate('/recaps')}>
            Weekly recap
          </button>
        </p>

        <hr className="hairline" style={{ marginTop: '0.75rem' }} />

        <section aria-label="Past days">
          <h2 className="muted small" style={{ fontWeight: 400 }}>
            Past days
          </h2>
          <ul className="list">
            {days.map((d) => {
              const e = byDate.get(d);
              return (
                <li key={d}>
                  <button className={e ? 'row' : 'row empty'} onClick={() => navigate(`/day/${d}`)}>
                    <span>{formatShort(d)}</span>
                    {e && <span className="meta">{describe(e)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {visible < span && (
            <button className="link" style={{ paddingLeft: 0 }} onClick={() => setShown(shown + PAGE)}>
              Show earlier days
            </button>
          )}
        </section>
      </div>
      <Footer />
    </div>
  );
}
