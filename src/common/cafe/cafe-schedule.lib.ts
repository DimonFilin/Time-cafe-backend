import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { timeToMinutes } from '../worker-schedule/worker-schedule.lib';

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type CafeScheduleDto = Partial<
  Record<
    (typeof DAYS)[number],
    { open?: string; close?: string; closed?: boolean }
  >
>;

export function scheduleDtoToJson(dto: CafeScheduleDto): Prisma.InputJsonValue {
  const out: Record<
    string,
    { open?: string; close?: string; closed?: boolean }
  > = {};
  for (const day of DAYS) {
    const s = dto[day];
    if (!s) continue;
    out[day] = {
      ...(s.open !== undefined ? { open: s.open } : {}),
      ...(s.close !== undefined ? { close: s.close } : {}),
      ...(s.closed !== undefined ? { closed: s.closed } : {}),
    };
  }
  return out;
}

export function validateCafeSchedule(dto: CafeScheduleDto) {
  for (const day of DAYS) {
    const schedule = dto[day];
    if (!schedule) continue;

    if (schedule.closed === true) continue;

    if (!schedule.open || !schedule.close) {
      throw new BadRequestException(
        `Open and close times are required for ${day} when the cafe is not closed`,
      );
    }

    const openM = timeToMinutes(schedule.open);
    const closeM = timeToMinutes(schedule.close);
    if (openM === closeM) {
      throw new BadRequestException(
        `Open and close must differ for ${day} when the cafe is not closed`,
      );
    }
  }
}
