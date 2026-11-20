import type { Entry } from '../lib/types';
import { STEPS } from '../lib/types';

function valueFor(stepIndex: number, e?: Entry): string | null {
  if (!e) return null;
  const key = STEPS[stepIndex].key;
  if (key === 'mood') {
    if (e.mood === undefined && !e.moodNote) return null;
    return [e.mood !== undefined ? `${e.mood}/10` : null, e.moodNote].filter(Boolean).join(' · ');
  }
  if (key === 'mindfulness') {
    if (!e.practiced) return null;
    return e.minutes ? `Practiced, ${e.minutes} min` : 'Practiced';
  }
  return e[key] ?? null;
}

interface Props {
  entry?: Entry;
  onEdit?: (stepIndex: number) => void;
  /** Show steps with nothing saved, as "Nothing saved". */
  showEmpty?: boolean;
}

export function SavedEntry({ entry, onEdit, showEmpty = false }: Props) {
  return (
    <div className="saved">
      {STEPS.map((s, i) => {
        const v = valueFor(i, entry);
        if (v === null && !showEmpty) return null;
        return (
          <div className="item" key={s.key}>
            <div className="item-head">
              <h3>{s.title}</h3>
              {onEdit && (
                <button className="link" onClick={() => onEdit(i)} aria-label={`Edit: ${s.title}`}>
                  {v === null ? 'Add' : 'Edit'}
                </button>
              )}
            </div>
            <p className={v === null ? 'value faint' : 'value'}>{v ?? 'Nothing saved'}</p>
          </div>
        );
      })}
    </div>
  );
}
