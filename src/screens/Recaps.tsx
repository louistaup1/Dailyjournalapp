import { useState } from 'react';
import { allRecaps, getSettings } from '../db';
import { formatRange, todayKey, weekEndingOn } from '../lib/dates';
import { navigate } from '../lib/router';
import { useLive } from '../lib/useLive';
import { createAiRecap, createLocalRecap } from '../recaps';
import { Footer } from '../components/Footer';

export function Recaps() {
  const recaps = useLive(allRecaps, []);
  const settings = useLive(getSettings, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const week = weekEndingOn(todayKey());

  const local = async () => {
    const id = await createLocalRecap();
    navigate(`/recap/${id}`);
  };
  const generate = async () => {
    setErr('');
    setBusy(true);
    try {
      const id = await createAiRecap();
      navigate(`/recap/${id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="topbar">
        <button className="link" onClick={() => navigate('/')}>
          Back
        </button>
      </div>
      <div className="grow">
        <h1 className="title">Weekly recap</h1>
        <p className="muted">The last 7 days: {formatRange(week.start, week.end)}.</p>

        <div className="stack">
          {settings?.apiKey ? (
            <>
              <button className="btn block" onClick={generate} disabled={busy}>
                {busy ? 'Generating…' : 'Generate recap · sends entries to Anthropic'}
              </button>
              <p className="muted small">
                Sends this week's entries, and last week's for comparison, to Anthropic to write the recap. Nothing
                is sent until you tap the button.
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
            <button className="link" style={{ paddingLeft: 0 }} onClick={local} disabled={busy}>
              Local summary
            </button>
            <span className="faint small"> · mood, mindfulness and counts only, stays on this phone</span>
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
                <span className="meta">{r.kind === 'ai' ? 'recap' : 'local summary'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Footer />
    </div>
  );
}
