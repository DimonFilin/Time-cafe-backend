import type { Prisma } from '@prisma/client';

export const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type TimeSegment = { open: string; close: string };

export type DayScheduleState =
  | { closed: true; segments?: never }
  | { closed: false; segments: TimeSegment[] };

export type WeeklyShiftSchedule = Partial<Record<WeekdayKey, DayScheduleState>>;

export type OpeningHoursJson = Prisma.JsonValue;

export type WorkerScheduleAbsenceKind = 'VACATION' | 'SICK_LEAVE';

export type EffectiveSegment = {
  startIso: string;
  endIso: string;
  /** YYYY-MM-DD MSK where segment starts */
  startDateMsk: string;
  open: string;
  close: string;
  source: 'WORKER' | 'CAFE';
};
