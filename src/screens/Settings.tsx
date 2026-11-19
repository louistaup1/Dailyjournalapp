import { useEffect, useRef, useState } from 'react';
import { allEntries, allRecaps, getSettings, importData, setSettings } from '../db';
import { isIOS, isStandalone, notificationSupport, type NotifySupport } from '../lib/reminders';
import { showReminder, syncReminders } from '../lib/reminderClient';
import type { Settings as SettingsT } from '../lib/types';
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
