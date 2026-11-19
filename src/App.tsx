import { useRoute } from './lib/router';
import { isDateKey, todayKey } from './lib/dates';
import { CheckIn } from './screens/CheckIn';
import { Day } from './screens/Day';
import { Home } from './screens/Home';
import { Settings } from './screens/Settings';

export function App() {
  const path = useRoute();
  const [section, a, b, c] = path;

  if (section === 'checkin') {
    const date = a && isDateKey(a) ? a : todayKey();
    return <CheckIn key={date} date={date} at={b} editing={c === 'edit'} />;
  }
  if (section === 'day' && a && isDateKey(a)) return <Day key={a} date={a} />;
  if (section === 'settings') return <Settings />;
  return <Home />;
}
