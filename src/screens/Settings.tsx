import { useEffect, useRef, useState } from 'react';
import { allEntries, allRecaps, getSettings, importData, setSettings } from '../db';
import { isIOS, isStandalone, notificationSupport, type NotifySupport } from '../lib/reminders';
import { showReminder, syncReminders } from '../lib/reminderClient';
import type { Settings as SettingsT } from '../lib/types';
import { weekdayName } from '../lib/dates';
import { checkPin, hashPin, isValidPin, newSalt } from '../lib/pin';
import { todayKey } from '../lib/dates';
import { parseImport, toExportJSON, toMarkdown } from '../lib/exportData';
import { saveFile } from '../lib/files';
import { navigate } from '../lib/router';
import { Footer } from '../components/Footer';

export function Settings() {
  return (
    <div className="page">
      <div className="topbar">
        <button className="link" onClick={() => navigate('/')}>
          Back
        </button>
      </div>
      <div className="grow">
        <h1 className="title">Settings</h1>
        <SettingsBody />
      </div>
      <Footer />
    </div>
  );
}

function SettingsBody() {
  const [s, setS] = useState<SettingsT | null>(null);
  useEffect(() => {
    void getSettings().then(setS);
  }, []);
  if (!s) return null;
  const update = async (patch: Partial<SettingsT>) => {
    setS((cur) => (cur ? { ...cur, ...patch } : cur));
    await setSettings(patch);
  };
  return (
    <>
      <ReminderSection s={s} update={update} />
      <RecapSection s={s} update={update} />
      <PinSection s={s} update={update} />
      <DataSection />
    </>
  );
}

type Update = (patch: Partial<SettingsT>) => Promise<void>;

function ReminderSection({ s, update }: { s: SettingsT; update: Update }) {
  const [support, setSupport] = useState<NotifySupport>(notificationSupport);
  const [note, setNote] = useState('');

  const toggle = async (on: boolean) => {
    void update({ reminderEnabled: on });
    if (on && support === 'default') {
      const p = await Notification.requestPermission();
      setSupport(notificationSupport());
      if (p !== 'granted') setNote('Notifications were not allowed. The prompt on the home screen still appears.');
    }
    await syncReminders();
  };

  const setTime = async (t: string) => {
    if (!t) return;
    // A new time today should be able to fire again.
    await update({ reminderTime: t, lastReminderDate: undefined });
    await syncReminders();
  };

  const test = async () => {
    setNote((await showReminder(true)) ? 'Sent.' : 'This browser could not show a notification.');
  };

  return (
    <section>
      <hr className="hairline" />
      <h2>Daily reminder</h2>
      <label className="check">
        <input type="checkbox" checked={s.reminderEnabled} onChange={(e) => void toggle(e.target.checked)} />
        Remind me each day
      </label>
      <div className="field" style={{ marginTop: '0.5rem' }}>
        <label htmlFor="rtime">Time</label>
        <input id="rtime" type="time" value={s.reminderTime} onChange={(e) => void setTime(e.target.value)} />
      </div>
      {support === 'unsupported' && (
        <p className="muted small">
          {isIOS() && !isStandalone()
            ? 'On iPhone, notifications work once the app is added to the Home Screen (iOS 16.4 or later). Open it from there and turn this on again.'
            : 'This browser cannot show notifications. The prompt on the home screen still appears.'}
        </p>
      )}
      {support === 'denied' && (
        <p className="muted small">Notifications are turned off for this app in the system or browser settings.</p>
      )}
      {s.reminderEnabled && support === 'ok' && (
        <>
          <p className="muted small">
            There is no server behind this app, so the phone decides when it may run. The reminder arrives when the
            app is open or in the background, or when Android wakes it, and may come later than the set time. If
            today's check-in isn't done, the home screen always shows a quiet prompt.
          </p>
          <button className="link" style={{ paddingLeft: 0 }} onClick={test}>
            Send a test reminder
          </button>
        </>
      )}
      {note && (
        <p className="muted small" role="status">
          {note}
        </p>
      )}
    </section>
  );
}

function RecapSection({ s, update }: { s: SettingsT; update: Update }) {
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);

  const saveKey = async () => {
    const k = key.trim();
    if (!k) return;
    await update({ apiKey: k });
    setKey('');
  };

  return (
    <section>
      <hr className="hairline" />
      <h2>Weekly recap</h2>
      <label className="check">
        <input type="checkbox" checked={s.recapAuto} onChange={(e) => void update({ recapAuto: e.target.checked })} />
        Make a local summary automatically each week
      </label>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.5rem 0 1rem' }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="rday">Day</label>
          <select id="rday" value={s.recapWeekday} onChange={(e) => void update({ recapWeekday: Number(e.target.value) })} style={{ width: 'auto' }}>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {weekdayName(d)}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="rrtime">Evening time</label>
          <input id="rrtime" type="time" value={s.recapTime} onChange={(e) => e.target.value && void update({ recapTime: e.target.value })} />
        </div>
      </div>
      <p className="muted small">
        The automatic summary uses only numbers from this phone. A written recap with themes and questions is made
        only when you tap Generate recap.
      </p>

      <h3 style={{ marginTop: '1.5rem' }}>Anthropic API key</h3>
      {s.apiKey ? (
        <>
          <p className="muted small">
            A key is saved on this phone: {show ? s.apiKey : `${s.apiKey.slice(0, 10)}…${s.apiKey.slice(-4)}`}.{' '}
            <button className="link inline" onClick={() => setShow(!show)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </p>
          <button className="link" style={{ paddingLeft: 0 }} onClick={() => void update({ apiKey: undefined })}>
            Remove key
          </button>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="apikey">Key</label>
            <input
              id="apikey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <button className="btn" onClick={saveKey} disabled={!key.trim()}>
            Save key
          </button>
        </>
      )}
      <p className="muted small" style={{ marginTop: '1rem' }}>
        The key is stored only in this app's storage on this phone and is sent only to api.anthropic.com when you
        generate a recap. It is not included in exports.
      </p>
    </section>
  );
}

function PinSection({ s, update }: { s: SettingsT; update: Update }) {
  const [mode, setMode] = useState<'idle' | 'set' | 'remove'>('idle');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState('');
  const [msg, setMsg] = useState('');
  const has = !!s.pinHash;

  const reset = (m = '') => {
    setMode('idle');
    setA('');
    setB('');
    setC('');
    setMsg(m);
  };

  const save = async () => {
    if (has && !(await checkPin(b, s.pinSalt, s.pinHash))) return setMsg('The current PIN didn\u2019t match.');
    if (!isValidPin(a)) return setMsg('Use 4 to 8 digits.');
    if (c !== a) return setMsg('The two PINs are different.');
    const salt = newSalt();
    await update({ pinSalt: salt, pinHash: await hashPin(a, salt) });
    reset('PIN saved. The app will ask for it when it opens.');
  };

  const remove = async () => {
    if (!(await checkPin(a, s.pinSalt, s.pinHash))) return setMsg('That PIN didn\u2019t match.');
    await update({ pinSalt: undefined, pinHash: undefined });
    reset('PIN removed.');
  };

  const digits = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value.replace(/\D/g, ''));

  return (
    <section>
      <hr className="hairline" />
      <h2>PIN lock</h2>
      <p className="muted small">
        {has ? 'The app asks for a PIN when it opens.' : 'Ask for a PIN when the app opens.'} This keeps the journal
        private on an unlocked phone; it does not encrypt the data. If the PIN is forgotten, the only way back in is
        to clear the app's data, so keep an export.
      </p>
      {mode === 'idle' && (
        <div>
          <button className="link" style={{ paddingLeft: 0 }} onClick={() => setMode('set')}>
            {has ? 'Change PIN' : 'Set a PIN'}
          </button>
          {has && (
            <button className="link" onClick={() => setMode('remove')}>
              Remove PIN
            </button>
          )}
        </div>
      )}
      {mode === 'set' && (
        <>
          {has && (
            <div className="field">
              <label htmlFor="pincur">Current PIN</label>
              <input id="pincur" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={b} onChange={digits(setB)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="pinnew">New PIN, 4 to 8 digits</label>
            <input id="pinnew" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={a} onChange={digits(setA)} />
          </div>
          <div className="field">
            <label htmlFor="pinagain">Same PIN again</label>
            <input id="pinagain" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={c} onChange={digits(setC)} />
          </div>
          <button className="btn" onClick={save}>
            Save PIN
          </button>
          <button className="link" onClick={() => reset()}>
            Cancel
          </button>
        </>
      )}
      {mode === 'remove' && (
        <>
          <div className="field">
            <label htmlFor="pinrm">Current PIN</label>
            <input id="pinrm" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={a} onChange={digits(setA)} />
          </div>
          <button className="btn" onClick={remove}>
            Remove PIN
          </button>
          <button className="link" onClick={() => reset()}>
            Cancel
          </button>
        </>
      )}
      {msg && (
        <p className="muted small" role="status" style={{ marginTop: '0.75rem' }}>
          {msg}
        </p>
      )}
    </section>
  );
}

function DataSection() {
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJSON = async () => {
    const json = toExportJSON(await allEntries(), await allRecaps());
    await saveFile(`journal-${todayKey()}.json`, 'application/json', json);
  };
  const exportMD = async () => {
    const md = toMarkdown(await allEntries(), await allRecaps());
    await saveFile(`journal-${todayKey()}.md`, 'text/markdown', md);
  };
  const onImport = async (file: File) => {
    try {
      const parsed = parseImport(await file.text());
      const r = await importData(parsed.entries, parsed.recaps);
      const parts = [`${r.added} new days`, `${r.updated} updated`];
      if (r.kept) parts.push(`${r.kept} kept (newer here)`);
      if (r.recaps) parts.push(`${r.recaps} recaps`);
      if (parsed.skipped) parts.push(`${parsed.skipped} items skipped`);
      setMsg(`Imported: ${parts.join(', ')}.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <section>
      <hr className="hairline" />
      <h2>Your data</h2>
      <p className="muted">
        Everything is stored only in this browser on this phone. Browser storage can be cleared by the system or by
        removing the app, so export a copy regularly.
      </p>
      <div className="stack">
        <div>
          <button className="link" style={{ paddingLeft: 0 }} onClick={exportJSON}>
            Export as JSON
          </button>
          <span className="faint small"> · full backup, can be imported</span>
        </div>
        <div>
          <button className="link" style={{ paddingLeft: 0 }} onClick={exportMD}>
            Export as Markdown
          </button>
          <span className="faint small"> · readable copy</span>
        </div>
        <div>
          <button className="link" style={{ paddingLeft: 0 }} onClick={() => fileRef.current?.click()}>
            Import from JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {msg && (
        <p className="muted" role="status" style={{ marginTop: '1rem' }}>
          {msg}
        </p>
      )}
    </section>
  );
}
