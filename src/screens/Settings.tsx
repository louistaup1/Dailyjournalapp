import { useRef, useState } from 'react';
import { allEntries, allRecaps, importData } from '../db';
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
        <DataSection />
      </div>
      <Footer />
    </div>
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
