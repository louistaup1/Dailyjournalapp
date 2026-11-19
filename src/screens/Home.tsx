import { getEntry } from '../db';
import { todayKey } from '../lib/dates';
import { navigate } from '../lib/router';
import { useLive } from '../lib/useLive';
import { Footer } from '../components/Footer';

export function Home() {
  const today = todayKey();
  const entry = useLive(() => getEntry(today), [today]);
  const done = !!entry?.completedAt;

  return (
    <div className="page">
      <div className="grow">
        {done ? (
          <p>
            Done for today{entry?.mood ? ` · mood ${entry.mood}/10` : ''}.{' '}
            <button className="link inline" onClick={() => navigate(`/checkin/${today}/summary`)}>
              View or edit
            </button>
          </p>
        ) : (
          <button className="btn block" onClick={() => navigate(`/checkin/${today}/0`)}>
            Start today's check-in
          </button>
        )}
      </div>
      <Footer />
    </div>
  );
}
