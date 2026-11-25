import { useEffect, useState } from 'react';
import { db, getSettings } from '../db';
import { formatLong, formatRange, formatShort, toDateKey } from '../lib/dates';
import { navigate } from '../lib/router';
import { compareWeeks, previousLabel } from '../lib/stats';
import { useLive } from '../lib/useLive';
import { FIELD_LABELS, REFLECTION_FIELDS, STEPS } from '../lib/types';
import { createAiRecap, deleteRecap, markSeen } from '../recaps';
import { Footer } from '../components/Footer';

export function RecapView({ id }: { id: number }) {
  const recap = useLive(async () => (await db.recaps.get(id)) ?? null, [id]);
  const settings = useLive(getSettings, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (recap && !recap.seen) void markSeen(id);
  }, [recap, id]);

  if (recap === undefined) return <div className="page" />;
  if (recap === null) {
    navigate('/recaps', true);
    return null;
  }

  const s = recap.stats;
  const m = s.mood;
  const changes = compareWeeks(s, recap.previous);
  // Weekday names are enough within one week; longer periods need the date.
  const week = m.byDay.length <= 7;
  const dayName = (d: string) => (week ? formatLong(d).split(' ')[0] : formatShort(d));

  const generate = async () => {
    setBusy(true);
    setErr('');
    try {
      const newId = await createAiRecap({ start: recap.start, end: recap.end });
      navigate(`/recap/${newId}`, true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (window.confirm('Delete this recap? Your entries are not affected.')) {
      await deleteRecap(id);
      navigate('/recaps', true);
    }
  };

  return (
    <div className="page">
      <div className="topbar">
        <button className="link" onClick={() => navigate('/recaps')}>
          Back
        </button>
      </div>
      <div className="grow recap">
        <p className="muted small">
          {recap.kind === 'ai' ? 'Recap' : 'Local summary'} · made {formatShort(toDateKey(new Date(recap.createdAt)))}
        </p>
        <h1 className="title">{formatRange(recap.start, recap.end)}</h1>
        <p className="muted">
          {s.daysWithEntries} of {m.byDay.length} days have entries.
        </p>
        {recap.note && <p className="notice muted small">{recap.note}</p>}

        <h2>Mood</h2>
        {m.count ? (
          <>
            <p>
              Average {m.average}.{' '}
              {m.highest && m.lowest && m.highest.date !== m.lowest.date
                ? `Highest ${m.highest.mood} on ${dayName(m.highest.date)}, lowest ${m.lowest.mood} on ${dayName(m.lowest.date)}.`
                : ''}
            </p>
            <div className={week ? 'days' : 'days long'} aria-label="Mood by day">
              {m.byDay.map((d) => (
                <div key={d.date}>
                  <div className="d">{week ? formatShort(d.date).split(' ')[0] : formatShort(d.date).split(' ').slice(0, 2).join(' ')}</div>
                  <div className={d.mood === null ? 'v faint' : 'v'}>{d.mood ?? '–'}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">No mood ratings this week.</p>
        )}

        <h2>Mindfulness</h2>
        <p>
          {s.mindfulness.daysPracticed} {s.mindfulness.daysPracticed === 1 ? 'day' : 'days'} practiced
          {s.mindfulness.totalMinutes ? `, ${s.mindfulness.totalMinutes} minutes in total` : ''}.
        </p>

        {recap.ai ? (
          <>
            {REFLECTION_FIELDS.map((f) => (
              <div key={f}>
                <h2>{STEPS.find((x) => x.key === f)?.title}</h2>
                {recap.ai!.themes[f].length ? (
                  <ul>
                    {recap.ai!.themes[f].map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Not enough written to see a pattern.</p>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            <h2>Entries</h2>
            <ul>
              {REFLECTION_FIELDS.map((f) => (
                <li key={f}>
                  {FIELD_LABELS[f]}: {s.counts[f]} {s.counts[f] === 1 ? 'day' : 'days'}
                </li>
              ))}
            </ul>
          </>
        )}

        {(changes.length > 0 || (recap.ai?.changes.length ?? 0) > 0) && (
          <>
            <h2>Compared with {previousLabel(s)}</h2>
            <ul>
              {changes.map((c, i) => (
                <li key={`s${i}`}>{c}</li>
              ))}
              {recap.ai?.changes.map((c, i) => (
                <li key={`a${i}`}>{c}</li>
              ))}
            </ul>
          </>
        )}

        {recap.ai && recap.ai.questions.length > 0 && (
          <>
            <h2>Questions you might bring to your next session</h2>
            <ul>
              {recap.ai.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </>
        )}

        {recap.kind === 'local' && settings?.apiKey && (
          <>
            <hr className="hairline" />
            <button className="btn block" onClick={generate} disabled={busy}>
              {busy ? 'Generating…' : 'Generate recap · sends entries to Anthropic'}
            </button>
            <p className="muted small">
              Sends the entries from this period, and from the same number of days before it for comparison, to
              Anthropic.
            </p>
            {err && (
              <p className="muted" role="alert">
                {err}
              </p>
            )}
          </>
        )}

        <hr className="hairline" />
        <button className="link" style={{ paddingLeft: 0 }} onClick={remove}>
          Delete this recap
        </button>
      </div>
      <Footer />
    </div>
  );
}
