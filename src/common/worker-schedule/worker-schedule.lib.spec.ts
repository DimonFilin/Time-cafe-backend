import {
  expandSegmentToUtcRange,
  needsConfirmShiftOn,
  needsConfirmShiftOff,
  segmentToLocalMinuteRange,
  segmentsTouchOrOverlap,
  validateWeeklyShiftSchedule,
  parseWorkerShiftSchedule,
  buildEffectiveScheduleWindow,
  isCafeOpeningHoursSet,
} from './worker-schedule.lib';
import type { WeeklyShiftSchedule } from './worker-schedule.types';

describe('worker-schedule.lib', () => {
  it('expands overnight segment', () => {
    const { start, end } = expandSegmentToUtcRange('2030-06-10', {
      open: '22:00',
      close: '06:00',
    });
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    expect((end.getTime() - start.getTime()) / 3600000).toBeCloseTo(8, 1);
  });

  it('allows touching segments, rejects overlap', () => {
    const a = segmentToLocalMinuteRange('2000-01-01', { open: '10:00', close: '14:00' });
    const b = segmentToLocalMinuteRange('2000-01-01', { open: '14:00', close: '18:00' });
    expect(segmentsTouchOrOverlap(a, b)).toBe('touch');
    const c = segmentToLocalMinuteRange('2000-01-01', { open: '13:00', close: '15:00' });
    expect(segmentsTouchOrOverlap(a, c)).toBe('overlap');
  });

  it('validateWeeklyShiftSchedule throws on overlap', () => {
    const bad: WeeklyShiftSchedule = {
      monday: {
        closed: false,
        segments: [
          { open: '10:00', close: '14:00' },
          { open: '13:00', close: '15:00' },
        ],
      },
    };
    expect(() => validateWeeklyShiftSchedule(bad)).toThrow(/Overlapping/);
  });

  it('needsConfirmShiftOn false when within window', () => {
    const start = new Date('2030-06-10T19:00:00.000Z');
    const end = new Date('2030-06-10T23:00:00.000Z');
    const now = new Date(start.getTime() + 2 * 60 * 1000);
    expect(needsConfirmShiftOn(now, [{ startIso: start.toISOString(), endIso: end.toISOString() }])).toBe(false);
  });

  it('needsConfirmShiftOff false near end', () => {
    const start = new Date('2030-06-10T19:00:00.000Z');
    const end = new Date('2030-06-10T23:00:00.000Z');
    const now = new Date(end.getTime() - 2 * 60 * 1000);
    expect(needsConfirmShiftOff(now, [{ startIso: start.toISOString(), endIso: end.toISOString() }])).toBe(false);
  });

  it('inherits cafe when worker schedule empty', () => {
    const cafe = {
      monday: { open: '09:00', close: '18:00' },
    };
    const segs = buildEffectiveScheduleWindow({
      fromYmd: '2030-06-10',
      days: 1,
      workerSchedule: parseWorkerShiftSchedule(null),
      cafeOpeningHours: cafe,
      absences: [],
    });
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs[0].source).toBe('CAFE');
  });

  it('isCafeOpeningHoursSet false for empty', () => {
    expect(isCafeOpeningHoursSet(null)).toBe(false);
    expect(isCafeOpeningHoursSet({})).toBe(false);
  });
});
