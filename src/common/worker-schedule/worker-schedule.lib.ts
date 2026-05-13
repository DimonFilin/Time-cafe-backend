import type { Prisma } from '@prisma/client';

import {
  WEEKDAY_KEYS,
  type WeekdayKey,
  type TimeSegment,
  type DayScheduleState,
  type WeeklyShiftSchedule,
  type EffectiveSegment,
  type OpeningHoursJson,
} from './worker-schedule.types';

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

export function timeToMinutes(t: string): number {
  const m = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.exec(t.trim());
  if (!m) throw new Error(`Invalid time: ${t}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** MSK calendar YYYY-MM-DD for instant */
export function mskYmdFromDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function mskWeekdayKeyFromYmd(ymd: string): WeekdayKey {
  const [y, mo, d] = ymd.split('-').map(Number);
  const anchor = new Date(Date.UTC(y, mo - 1, d, 9, 0, 0));
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    weekday: 'short',
  }).format(anchor);
  const map: Record<string, WeekdayKey> = {
    Mon: 'monday',
    Tue: 'tuesday',
    Wed: 'wednesday',
    Thu: 'thursday',
    Fri: 'friday',
    Sat: 'saturday',
    Sun: 'sunday',
  };
  return map[wd] ?? 'monday';
}

export function mskAddDays(ymd: string, delta: number): string {
  const [y, mo, d] = ymd.split('-').map(Number);
  const t = Date.UTC(y, mo - 1, d, 12, 0, 0) + delta * 86400000;
  return mskYmdFromDate(new Date(t));
}

/** Any MSK calendar date that falls on the given weekday (for template bounds checks). */
export function sampleYmdForWeekdayKey(day: WeekdayKey): string {
  let ymd = '2030-01-01';
  for (let i = 0; i < 14; i++) {
    if (mskWeekdayKeyFromYmd(ymd) === day) return ymd;
    ymd = mskAddDays(ymd, 1);
  }
  return '2030-01-01';
}

export function enumerateMskDates(fromYmd: string, count: number): string[] {
  const out: string[] = [];
  let cur = fromYmd;
  for (let i = 0; i < count; i++) {
    out.push(cur);
    cur = mskAddDays(cur, 1);
  }
  return out;
}

/** Instant (UTC) for YYYY-MM-DD 00:00:00 MSK */
export function mskMidnightUtc(ymd: string): Date {
  const [y, mo, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0) - MSK_OFFSET_MS);
}

export function mskWallTimeUtc(ymd: string, hhmm: string): Date {
  const mins = timeToMinutes(hhmm);
  const start = mskMidnightUtc(ymd);
  return new Date(start.getTime() + mins * 60000);
}

/**
 * Segment on calendar day `ymd` (MSK): open at wall time; close same day or next MSK day if night.
 */
export function expandSegmentToUtcRange(
  ymd: string,
  seg: TimeSegment,
): { start: Date; end: Date } {
  const openM = timeToMinutes(seg.open);
  const closeM = timeToMinutes(seg.close);
  const start = mskWallTimeUtc(ymd, seg.open);
  if (closeM > openM) {
    return { start, end: mskWallTimeUtc(ymd, seg.close) };
  }
  const endYmd = mskAddDays(ymd, 1);
  return { start, end: mskWallTimeUtc(endYmd, seg.close) };
}

/** Minutes from D 00:00 MSK, end may exceed 1440 for overnight */
export function segmentToLocalMinuteRange(
  ymd: string,
  seg: TimeSegment,
): { start: number; end: number } {
  const openM = timeToMinutes(seg.open);
  const closeM = timeToMinutes(seg.close);
  if (closeM > openM) {
    return { start: openM, end: closeM };
  }
  return { start: openM, end: closeM + 1440 };
}

export function segmentsTouchOrOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): 'overlap' | 'touch' | 'none' {
  const lo = Math.max(a.start, b.start);
  const hi = Math.min(a.end, b.end);
  if (lo < hi) return 'overlap';
  if (lo === hi) return 'touch';
  return 'none';
}

export function parseOpeningHoursDay(
  raw: OpeningHoursJson,
  day: WeekdayKey,
): DayScheduleState | null {
  if (!raw || !isRecord(raw)) return null;
  const dayRaw = raw[day];
  if (!dayRaw || !isRecord(dayRaw)) return null;
  if (dayRaw.closed === true) {
    return { closed: true };
  }
  const open = typeof dayRaw.open === 'string' ? dayRaw.open : undefined;
  const close = typeof dayRaw.close === 'string' ? dayRaw.close : undefined;
  if (open && close) {
    return { closed: false, segments: [{ open, close }] };
  }
  return null;
}

/** Normalize worker shiftSchedule JSON to weekly map with segments */
export function parseWorkerShiftSchedule(
  raw: Prisma.JsonValue | null | undefined,
): WeeklyShiftSchedule | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;
  const out: WeeklyShiftSchedule = {};
  for (const day of WEEKDAY_KEYS) {
    const v = raw[day];
    if (!v || !isRecord(v)) continue;
    if (v.closed === true) {
      out[day] = { closed: true };
      continue;
    }
    if (Array.isArray(v.segments)) {
      const segments: TimeSegment[] = [];
      for (const s of v.segments) {
        if (!isRecord(s)) continue;
        const open = typeof s.open === 'string' ? s.open : '';
        const close = typeof s.close === 'string' ? s.close : '';
        if (
          /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(open) &&
          /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(close)
        ) {
          segments.push({ open, close });
        }
      }
      out[day] = { closed: false, segments };
      continue;
    }
    const open = typeof v.open === 'string' ? v.open : undefined;
    const close = typeof v.close === 'string' ? v.close : undefined;
    if (
      open &&
      close &&
      /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(open) &&
      /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(close)
    ) {
      out[day] = { closed: false, segments: [{ open, close }] };
    }
  }
  return Object.keys(out).length ? out : null;
}

export function isWeeklyShiftScheduleEmpty(
  schedule: WeeklyShiftSchedule | null,
): boolean {
  if (!schedule) return true;
  for (const day of WEEKDAY_KEYS) {
    const st = schedule[day];
    if (!st) continue;
    if (!st.closed && st.segments.length > 0) return false;
  }
  return true;
}

export function isCafeOpeningHoursSet(raw: OpeningHoursJson): boolean {
  if (!raw || !isRecord(raw)) return false;
  for (const day of WEEKDAY_KEYS) {
    const d = parseOpeningHoursDay(raw, day);
    if (d && !d.closed && d.segments.length > 0) return true;
    if (d?.closed === true) return true;
  }
  return false;
}

export function validateWeeklyShiftSchedule(
  schedule: WeeklyShiftSchedule,
): void {
  for (const day of WEEKDAY_KEYS) {
    const st = schedule[day];
    if (!st) continue;
    if (st.closed) continue;
    const segs = [...st.segments];
    for (const s of segs) {
      timeToMinutes(s.open);
      timeToMinutes(s.close);
    }
    for (let i = 0; i < segs.length; i++) {
      const r1 = segmentToLocalMinuteRange('2000-01-01', segs[i]);
      for (let j = i + 1; j < segs.length; j++) {
        const r2 = segmentToLocalMinuteRange('2000-01-01', segs[j]);
        if (segmentsTouchOrOverlap(r1, r2) === 'overlap') {
          throw new Error(`Overlapping segments on ${day}`);
        }
      }
    }
  }
}

export function dayStateToSegments(
  state: DayScheduleState | null,
): TimeSegment[] {
  if (!state || state.closed) return [];
  return state.segments;
}

export function absenceCoversDate(
  absenceStart: Date,
  absenceEnd: Date,
  ymd: string,
): boolean {
  const d = mskMidnightUtc(ymd);
  return (
    d.getTime() >= absenceStart.getTime() && d.getTime() <= absenceEnd.getTime()
  );
}

export function buildEffectiveScheduleWindow(params: {
  fromYmd: string;
  days: number;
  workerSchedule: WeeklyShiftSchedule | null;
  cafeOpeningHours: OpeningHoursJson;
  absences: { startDate: Date; endDate: Date }[];
}): EffectiveSegment[] {
  const dates = enumerateMskDates(params.fromYmd, params.days);
  const segs: EffectiveSegment[] = [];
  for (const ymd of dates) {
    const absent = params.absences.some((a) =>
      absenceCoversDate(a.startDate, a.endDate, ymd),
    );
    const wd = mskWeekdayKeyFromYmd(ymd);
    const { segments, source } = buildEffectiveSegmentsForDay({
      ymd,
      weekday: wd,
      workerSchedule: params.workerSchedule,
      cafeOpeningHours: params.cafeOpeningHours,
      absent,
    });
    segs.push(...effectiveSegmentsToAbsolute(ymd, segments, source));
  }
  return segs.sort((a, b) => a.startIso.localeCompare(b.startIso));
}

export function buildEffectiveSegmentsForDay(params: {
  ymd: string;
  weekday: WeekdayKey;
  workerSchedule: WeeklyShiftSchedule | null;
  cafeOpeningHours: OpeningHoursJson;
  absent: boolean;
}): { segments: TimeSegment[]; source: 'WORKER' | 'CAFE' } {
  if (params.absent) {
    return { segments: [], source: 'WORKER' };
  }
  const useWorker =
    params.workerSchedule && !isWeeklyShiftScheduleEmpty(params.workerSchedule);
  if (useWorker) {
    const st = params.workerSchedule![params.weekday];
    if (st?.closed) return { segments: [], source: 'WORKER' };
    if (st && !st.closed && st.segments.length) {
      return { segments: st.segments, source: 'WORKER' };
    }
  }
  const cafeDay = parseOpeningHoursDay(params.cafeOpeningHours, params.weekday);
  const segs = dayStateToSegments(cafeDay);
  return { segments: segs, source: 'CAFE' };
}

export function effectiveSegmentsToAbsolute(
  ymd: string,
  segments: TimeSegment[],
  source: 'WORKER' | 'CAFE',
): EffectiveSegment[] {
  return segments.map((seg) => {
    const { start, end } = expandSegmentToUtcRange(ymd, seg);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      startDateMsk: ymd,
      open: seg.open,
      close: seg.close,
      source,
    };
  });
}

/** Segment fully inside union of cafe segments on same weekday (same MSK calendar day base) */
export function segmentWithinCafeDay(
  ymd: string,
  seg: TimeSegment,
  cafeSegments: TimeSegment[],
): boolean {
  if (cafeSegments.length === 0) return false;
  const { start: ws, end: we } = expandSegmentToUtcRange(ymd, seg);
  for (const c of cafeSegments) {
    const { start: cs, end: ce } = expandSegmentToUtcRange(ymd, c);
    if (ws.getTime() >= cs.getTime() && we.getTime() <= ce.getTime()) {
      return true;
    }
  }
  return false;
}

export function workerDayViolatesCafeBounds(params: {
  ymd: string;
  weekday: WeekdayKey;
  workerSegments: TimeSegment[];
  cafeOpeningHours: OpeningHoursJson;
}): TimeSegment[] {
  const cafeDay = parseOpeningHoursDay(params.cafeOpeningHours, params.weekday);
  const cafeSegs = dayStateToSegments(cafeDay);
  const bad: TimeSegment[] = [];
  for (const s of params.workerSegments) {
    if (!segmentWithinCafeDay(params.ymd, s, cafeSegs)) {
      bad.push(s);
    }
  }
  return bad;
}

const WINDOW_MS = 10 * 60 * 1000;

/** Clock-in: confirm unless now within ±10m of any segment start (all overlapping segments). */
export function needsConfirmShiftOn(
  now: Date,
  segments: { startIso: string; endIso: string }[],
): boolean {
  if (segments.length === 0) return false;
  for (const s of segments) {
    const start = new Date(s.startIso);
    if (
      now.getTime() >= start.getTime() - WINDOW_MS &&
      now.getTime() <= start.getTime() + WINDOW_MS
    ) {
      return false;
    }
  }
  return true;
}

/** Clock-out: confirm unless now within ±10m of any segment end. */
export function needsConfirmShiftOff(
  now: Date,
  segments: { startIso: string; endIso: string }[],
): boolean {
  if (segments.length === 0) return false;
  for (const s of segments) {
    const end = new Date(s.endIso);
    if (
      now.getTime() >= end.getTime() - WINDOW_MS &&
      now.getTime() <= end.getTime() + WINDOW_MS
    ) {
      return false;
    }
  }
  return true;
}
