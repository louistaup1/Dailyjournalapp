import { useEffect, useRef, useState } from 'react';
import { getSettings } from './db';
import { useRoute } from './lib/router';
import { isDateKey, todayKey } from './lib/dates';
import { useLive } from './lib/useLive';
import { CheckIn } from './screens/CheckIn';
import { Day } from './screens/Day';
import { Home } from './screens/Home';
import { Lock } from './screens/Lock';
import { Settings } from './screens/Settings';
import { Recaps } from './screens/Recaps';
import { RecapView } from './screens/RecapView';

/** Re-lock after the app has been in the background this long. */
const RELOCK_MS = 60_000;

export function App() {
  const settings = useLive(getSettings, []);
  const [unlocked, setUnlocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const on = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_MS) setUnlocked(false);
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  // With no PIN at open, the session starts unlocked, so setting a PIN in
  // Settings takes effect at the next open (or after time in the background)
  // instead of locking the screen mid-use.
  const initialized = useRef(false);
  useEffect(() => {
    if (settings && !initialized.current) {
      initialized.current = true;
      if (!settings.pinHash) setUnlocked(true);
    }
  }, [settings]);

  if (!settings) return <div className="page" />;
  if (settings.pinHash && settings.pinSalt && !unlocked) {
    return <Lock salt={settings.pinSalt} hash={settings.pinHash} onUnlock={() => setUnlocked(true)} />;
  }
  return <Routes />;
}

function Routes() {
  const path = useRoute();
  const [section, a, b, c] = path;

  if (section === 'checkin') {
    const date = a && isDateKey(a) ? a : todayKey();
    return <CheckIn key={date} date={date} at={b} editing={c === 'edit'} />;
  }
  if (section === 'day' && a && isDateKey(a)) return <Day key={a} date={a} />;
  if (section === 'settings') return <Settings />;
  if (section === 'recaps') return <Recaps />;
  if (section === 'recap' && a && /^\d+$/.test(a)) return <RecapView key={a} id={Number(a)} />;
  return <Home />;
}
