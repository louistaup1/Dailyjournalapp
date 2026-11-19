import { deleteEntry, getEntry } from '../db';
import { formatLong, todayKey, type DateKey } from '../lib/dates';
import { navigate } from '../lib/router';
import { useLive } from '../lib/useLive';
import { Footer } from '../components/Footer';
import { SavedEntry } from '../components/SavedEntry';

export function Day({ date }: { date: DateKey }) {
  const entry = useLive(async () => (await getEntry(date)) ?? null, [date]);
  if (entry === undefined) return <div className="page" />;
  const isToday = date === todayKey();

  const remove = async () => {
    if (window.confirm(`Delete everything written on ${formatLong(date)}? This can't be undone.`)) {
      await deleteEntry(date);
      navigate('/');
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
        <p className="muted small">{isToday ? 'Today' : ''}</p>
        <h1 className="title">{formatLong(date)}</h1>
        {entry ? (
          <>
            <SavedEntry entry={entry} showEmpty onEdit={(i) => navigate(`/checkin/${date}/${i}/edit`)} />
            <hr className="hairline" />
            <button className="link" style={{ paddingLeft: 0 }} onClick={remove}>
              Delete this day
            </button>
          </>
        ) : (
          <>
            <p className="muted">Nothing was written on this day.</p>
            <button className="btn" onClick={() => navigate(`/checkin/${date}/0`)}>
              Write an entry
            </button>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
