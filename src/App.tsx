import { useRoute } from './lib/router';
import { isDateKey, todayKey } from './lib/dates';
import { CheckIn } from './screens/CheckIn';
import { Home } from './screens/Home';

export function App() {
  const path = useRoute();
  const [section, a, b, c] = path;

  if (section === 'checkin') {
    const date = a && isDateKey(a) ? a : todayKey();
    return <CheckIn key={date} date={date} at={b} editing={c === 'edit'} />;
  }
  return <Home />;
}
