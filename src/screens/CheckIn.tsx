import { useEffect, useState } from 'react';
import { getEntry, markComplete, requestPersistence, saveEntry } from '../db';
import { formatLong, todayKey, type DateKey } from '../lib/dates';
import { navigate } from '../lib/router';
import type { Entry, EntryPatch, ReflectionField } from '../lib/types';
import { INTRO, STEPS } from '../lib/types';
import { Footer } from '../components/Footer';
import { SavedEntry } from '../components/SavedEntry';

interface Draft {
  mood?: number;
  moodNote: string;
  thoughts: string;
  feelings: string;
  response: string;
  values: string;
  practiced: boolean;
  minutes: string;
}

function draftFrom(e?: Entry): Draft {
  return {
    mood: e?.mood,
    moodNote: e?.moodNote ?? '',
    thoughts: e?.thoughts ?? '',
    feelings: e?.feelings ?? '',
    response: e?.response ?? '',
    values: e?.values ?? '',
    practiced: e?.practiced ?? false,
    minutes: e?.minutes ? String(e.minutes) : '',
  };
}

function patchFor(stepIndex: number, d: Draft): EntryPatch {
  const key = STEPS[stepIndex].key;
  if (key === 'mood') return { mood: d.mood, moodNote: d.moodNote };
  if (key === 'mindfulness') {
    const m = parseInt(d.minutes, 10);
    return { practiced: d.practiced || undefined, minutes: Number.isFinite(m) ? m : undefined };
  }
  return { [key]: d[key] } as EntryPatch;
}

/** Restore one step's fields in the draft from what is stored. */
function resetStep(stepIndex: number, d: Draft, e?: Entry): Draft {
  const stored = draftFrom(e);
  const key = STEPS[stepIndex].key;
  if (key === 'mood') return { ...d, mood: stored.mood, moodNote: stored.moodNote };
  if (key === 'mindfulness') return { ...d, practiced: stored.practiced, minutes: stored.minutes };
  return { ...d, [key]: stored[key] };
}

interface Props {
  date: DateKey;
  /** A step number, or "summary". */
  at?: string;
  /** True when a single step was opened from the summary to edit it. */
  editing?: boolean;
}

export function CheckIn({ date, at, editing = false }: Props) {
  const [entry, setEntry] = useState<Entry | undefined>();
  const [draft, setDraft] = useState<Draft | null>(null);

  const stepIndex = at === 'summary' ? -1 : Math.min(Math.max(parseInt(at ?? '0', 10) || 0, 0), STEPS.length - 1);
  const base = `/checkin/${date}`;

  useEffect(() => {
    let live = true;
    getEntry(date).then((e) => {
      if (!live) return;
      setEntry(e);
      setDraft(draftFrom(e));
    });
    return () => {
      live = false;
    };
  }, [date]);

  if (!draft) return <div className="page" />;

  const go = (where: string) => navigate(`${base}/${where}`, true);
  const isToday = date === todayKey();

  if (stepIndex === -1) {
    return (
      <div className="page">
        <div className="grow step">
          <p className="muted small">{isToday ? 'Today' : formatLong(date)}</p>
          <h1 className="title">{entry ? 'Saved' : 'Nothing was saved'}</h1>
          <p className="muted">
            {entry ? 'Here is what you wrote. You can change anything before leaving.' : 'Every step was skipped or left blank.'}
          </p>
          <SavedEntry entry={entry} onEdit={(i) => go(`${i}/edit`)} showEmpty />
        </div>
        <div className="actions">
          <span className="spacer" />
          <button className="btn" onClick={() => navigate('/')}>
            Done
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const step = STEPS[stepIndex];
  const last = stepIndex === STEPS.length - 1;

  const advance = async () => {
    if (editing) return go('summary');
    if (last) {
      await markComplete(date);
      return go('summary');
    }
    go(String(stepIndex + 1));
  };

  const next = async () => {
    const saved = await saveEntry(date, patchFor(stepIndex, draft));
    setEntry(saved);
    if (saved) void requestPersistence();
    await advance();
  };

  const skip = async () => {
    setDraft(resetStep(stepIndex, draft, entry));
    await advance();
  };

  const back = () => {
    if (editing) return go('summary');
    if (stepIndex === 0) return navigate('/');
    go(String(stepIndex - 1));
  };

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  return (
    <div className="page">
      <div className="progress" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
        <div className="bar">
          <span style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
        </div>
        <span className="faint small">
          {stepIndex + 1} of {STEPS.length}
          {!isToday && ` · ${formatLong(date)}`}
        </span>
      </div>

      <div className="grow step" key={stepIndex}>
        {stepIndex === 1 && <p className="muted">{INTRO}</p>}
        <h1 className="title">{step.title}</h1>
        {step.prompt && <p className="muted">{step.prompt}</p>}

        {step.key === 'mood' && (
          <>
            <div className="mood" role="group" aria-label="Mood from 1 to 10">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={draft.mood === n}
                  onClick={() => set({ mood: draft.mood === n ? undefined : n })}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mood-ends faint small" aria-hidden="true">
              <span>low</span>
              <span>high</span>
            </div>
            <div className="field">
              <label htmlFor="moodNote">A note, if you like</label>
              <input
                id="moodNote"
                type="text"
                value={draft.moodNote}
                maxLength={200}
                autoComplete="off"
                onChange={(e) => set({ moodNote: e.target.value })}
              />
            </div>
          </>
        )}

        {(['thoughts', 'feelings', 'response', 'values'] as ReflectionField[]).includes(step.key as ReflectionField) && (
          <>
            <label htmlFor="text" className="sr-only">
              {step.title}
            </label>
            <textarea
              id="text"
              value={draft[step.key as ReflectionField]}
              onChange={(e) => set({ [step.key]: e.target.value })}
            />
          </>
        )}

        {step.key === 'mindfulness' && (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.practiced}
                onChange={(e) => set({ practiced: e.target.checked })}
              />
              I practiced mindfulness today
            </label>
            {draft.practiced && (
              <div className="field" style={{ marginTop: '0.75rem' }}>
                <label htmlFor="minutes">Minutes, if you want to note them</label>
                <input
                  id="minutes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1440}
                  value={draft.minutes}
                  onChange={(e) => set({ minutes: e.target.value })}
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="actions">
        <button className="link" onClick={back}>
          Back
        </button>
        <span className="spacer" />
        <button className="link" onClick={skip}>
          Skip
        </button>
        <button className="btn" onClick={next}>
          {editing ? 'Save' : last ? 'Finish' : 'Next'}
        </button>
      </div>
      <Footer />
    </div>
  );
}
