import type { DateKey } from './dates';

export const REFLECTION_FIELDS = ['thoughts', 'feelings', 'response', 'values'] as const;
export type ReflectionField = (typeof REFLECTION_FIELDS)[number];

/** One day's check-in. Only non-blank fields are stored. */
export interface Entry {
  date: DateKey; // primary key
  mood?: number; // 1–10
  moodNote?: string;
  thoughts?: string;
  feelings?: string;
  response?: string;
  values?: string;
  practiced?: boolean;
  minutes?: number;
  completedAt?: number; // set when the check-in reaches its summary
  createdAt: number;
  updatedAt: number;
}

export type EntryPatch = Partial<Omit<Entry, 'date' | 'createdAt' | 'updatedAt'>>;

export interface WeekStats {
  start: DateKey;
  end: DateKey;
  daysWithEntries: number;
  mood: {
    count: number;
    average: number | null;
    highest: { date: DateKey; mood: number } | null;
    lowest: { date: DateKey; mood: number } | null;
    byDay: { date: DateKey; mood: number | null }[];
  };
  mindfulness: { daysPracticed: number; totalMinutes: number };
  counts: Record<ReflectionField, number>;
}

export interface AiRecap {
  themes: Record<ReflectionField, string[]>;
  changes: string[];
  questions: string[];
}

export interface Recap {
  id?: number;
  kind: 'local' | 'ai';
  start: DateKey;
  end: DateKey;
  createdAt: number;
  auto: boolean;
  stats: WeekStats;
  previous: WeekStats | null;
  ai?: AiRecap;
  seen?: boolean;
}

export interface Settings {
  reminderEnabled: boolean;
  reminderTime: string; // "HH:MM"
  lastReminderDate?: DateKey;
  recapAuto: boolean;
  recapWeekday: number; // 0 = Sunday
  recapTime: string; // "HH:MM"
  lastAutoRecapEnd?: DateKey;
  apiKey?: string;
  pinHash?: string;
  pinSalt?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  reminderEnabled: false,
  reminderTime: '09:00',
  recapAuto: true,
  recapWeekday: 0,
  recapTime: '19:00',
};

export interface Step {
  key: 'mood' | ReflectionField | 'mindfulness';
  title: string;
  prompt?: string;
}

export const STEPS: Step[] = [
  { key: 'mood', title: 'How do I feel today?' },
  { key: 'thoughts', title: 'What thoughts did I notice?', prompt: 'What was my mind telling me?' },
  { key: 'feelings', title: 'What feelings did I experience?', prompt: 'What emotions or physical sensations showed up?' },
  { key: 'response', title: 'How did I respond?', prompt: 'What did I do in response to those thoughts and feelings?' },
  {
    key: 'values',
    title: 'Did my response move me toward or away from what matters to me?',
    prompt: 'What did I notice? Is there anything I might approach differently?',
  },
  { key: 'mindfulness', title: 'Mindfulness practice' },
];

export const INTRO =
  'Take 2–5 minutes to reflect on one experience from your day. There are no right answers. Approach your experience with curiosity, not judgment.';

export const FIELD_LABELS: Record<ReflectionField, string> = {
  thoughts: 'Thoughts',
  feelings: 'Feelings',
  response: 'Response',
  values: 'Toward or away',
};
