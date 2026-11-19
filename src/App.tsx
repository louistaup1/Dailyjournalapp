import { useRoute } from './lib/router';
import { isDateKey, todayKey } from './lib/dates';
import { CheckIn } from './screens/CheckIn';
import { Day } from './screens/Day';
import { Home } from './screens/Home';
import { Settings } from './screens/Settings';
import { Recaps } from './screens/Recaps';
import { RecapView } from './screens/RecapView';

export function App() {
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
