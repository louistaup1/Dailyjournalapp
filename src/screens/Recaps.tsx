import { useState } from 'react';
import { allRecaps, getSettings } from '../db';
import { addDays, formatRange, todayKey } from '../lib/dates';
import { periodFor, periodLength as length, type Choice } from '../lib/periods';
import { navigate } from '../lib/router';
import { useLive } from '../lib/useLive';
import { createAiRecap, createLocalRecap, lastRecapEnd } from '../recaps';
import type { Period } from '../lib/periods';
import { Footer } from '../components/Footer';

export function Recaps() {
  const recaps = useLive(allRecaps, []);
  const settings = useLive(getSettings, []);
  const lastEnd = useLive(lastRecapEnd, []);
  const today = todayKey();
  const [choice, setChoice] = useState<Choice>('7');
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const period = periodFor(choice, today, lastEnd ?? null, from, to);
  const ok = typeof period !== 'string';

  const run = async (make: (p: Period) => Promise<number>) => {
    if (!ok) return;
    setErr('');
    setBusy(true);
    try {
      navigate(`/recap/${await make(period)}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const since = periodFor('since', today, lastEnd ?? null, from, to);

  const option = (value: Choice, label: string, detail?: string, disabled = false) => (
    <label className="check" style={disabled ? { opacity: 0.5 } : undefined}>
      <input type="radio" name="period" value={value} checked={choice === value} disabled={disabled} onChange={() => setChoice(value)} />
      <span>
        {label}
        {detail && <span className="faint small"> · {detail}</span>}
      </span>
    </label>
  );

  return (
    <div className="page">
      <div className="topbar">
        <button className="link" onClick={() => navigate('/')}>
          Back
        </button>
      </div>
      <div className="grow">
        <h1 className="title">Recap</h1>
        <p className="muted">
          Make a recap whenever you like, for example before a session. The weekly recap still comes on its own.
        </p>

        <fieldset style={{ border: 0, margin: '0 0 1rem', padding: 0 }}>
          <legend className="muted small" style={{ padding: 0, marginBottom: '0.25rem' }}>
            Period
          </legend>
          {option('7', 'Last 7 days', formatRange(addDays(today, -6), today))}
          {option('14', 'Last 14 days', formatRange(addDays(today, -13), today))}
          {option(
            'since',
            'Since my last recap',
            typeof since === 'string' ? since : `${formatRange(since.start, since.end)}, ${length(since)} ${length(since) === 1 ? 'day' : 'days'}`,
            typeof since === 'string',
          )}
          {option('custom', 'Choose dates')}
          {choice === 'custom' && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.25rem 0 0 2.1rem' }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="from">From</label>
                <input id="from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="to">To</label>
                <input id="to" type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}
          {choice === 'custom' && !ok && (
            <p className="muted small" role="status" style={{ margin: '0.5rem 0 0 2.1rem' }}>
              {period}
            </p>
          )}
        </fieldset>

        <div className="stack">
          {settings?.apiKey ? (
            <>
              <button className="btn block" onClick={() => run(createAiRecap)} disabled={busy || !ok}>
                {busy ? 'Generating…' : 'Generate recap · sends entries to Anthropic'}
              </button>
              <p className="muted small">
                Sends the entries from this period, and from the same number of days before it for comparison, to
                Anthropic to write the recap.
              </p>
            </>
          ) : (
            <p className="muted small">
              To generate a written recap, add an Anthropic API key in{' '}
              <button className="link inline" onClick={() => navigate('/settings')}>
                Settings
              </button>
              .
            </p>
          )}
          {err && (
            <p className="muted" role="alert">
              {err}
            </p>
          )}
          <div>
            <button className="link" style={{ paddingLeft: 0 }} onClick={() => run(createLocalRecap)} disabled={busy || !ok}>
              Local summary
            </button>
            <p className="faint small" style={{ margin: 0 }}>
              Mood, mindfulness and counts only. Stays on this phone.
            </p>
          </div>
        </div>

        <hr className="hairline" />
        <h2 className="muted small" style={{ fontWeight: 400 }}>
          Past recaps
        </h2>
        {recaps && recaps.length === 0 && <p className="faint">None yet.</p>}
        <ul className="list">
          {recaps?.map((r) => (
            <li key={r.id}>
              <button className="row" onClick={() => navigate(`/recap/${r.id}`)}>
                <span>{formatRange(r.start, r.end)}</span>
                <span className="meta">
                  {r.kind === 'ai' ? 'recap' : 'local summary'}
                  {r.auto ? ' · weekly' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Footer />
    </div>
  );
}
