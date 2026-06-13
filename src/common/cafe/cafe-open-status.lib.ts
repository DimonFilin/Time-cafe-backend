type DayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

const DAY_KEYS: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

type DaySchedule = { open?: string; close?: string; closed?: boolean };

function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

function todayDayKey(now = new Date()): DayKey {
  const idx = now.getDay();
  return DAY_KEYS[idx === 0 ? 6 : idx - 1];
}

export function isCafeOpenNow(
  openingHours: unknown,
  now = new Date(),
): boolean | null {
  if (!openingHours || typeof openingHours !== 'object') return null;
  const day = todayDayKey(now);
  const schedule = (openingHours as Record<string, DaySchedule>)[day];
  if (!schedule) return null;
  if (schedule.closed) return false;
  if (!schedule.open || !schedule.close) return null;

  const openM = parseHm(schedule.open);
  const closeM = parseHm(schedule.close);
  if (openM === null || closeM === null) return null;

  const nowM = now.getHours() * 60 + now.getMinutes();
  if (openM === closeM) return false;
  if (openM < closeM) {
    return nowM >= openM && nowM < closeM;
  }
  return nowM >= openM || nowM < closeM;
}
