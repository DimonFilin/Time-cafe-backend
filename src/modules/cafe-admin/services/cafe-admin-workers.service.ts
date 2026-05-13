import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { KeycloakService } from '../../auth/services/keycloak.service';
import { InviteWorkerDto } from '../dto/invite-worker.dto';
import { UpdateWorkerDto } from '../dto/update-worker.dto';
import {
  CreateWorkerScheduleAbsenceDto,
  UpdateWorkerShiftScheduleDto,
} from '../dto/worker-shift-schedule.dto';
import { Prisma, WorkerRole } from '@prisma/client';
import {
  WEEKDAY_KEYS,
  type WeekdayKey,
  type WeeklyShiftSchedule,
} from '../../../common/worker-schedule/worker-schedule.types';
import {
  validateWeeklyShiftSchedule,
  isCafeOpeningHoursSet,
  workerDayViolatesCafeBounds,
  sampleYmdForWeekdayKey,
} from '../../../common/worker-schedule/worker-schedule.lib';

@Injectable()
export class CafeAdminWorkersService {
  private readonly logger = new Logger(CafeAdminWorkersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keycloakService: KeycloakService,
  ) {}

  async inviteWorker(cafeId: string, dto: InviteWorkerDto) {
    // Validate email uniqueness
    const existing = await this.prisma.workerAccount.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    // Get cafe to get brandId
    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
    });

    if (!cafe) {
      throw new NotFoundException('Cafe not found');
    }

    // Create in Keycloak
    const keycloakId = await this.keycloakService.createUser(
      dto.email,
      dto.password,
    );

    // Create in database
    const worker = await this.prisma.workerAccount.create({
      data: {
        keycloakId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: WorkerRole.WORKER,
        cafeId,
        brandId: cafe.brandId,
      },
    });

    this.logger.log(`Worker invited: ${worker.email} to cafe ${cafeId}`);

    return worker;
  }

  async getWorkers(
    cafeId: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      shiftStatus?: 'ON_SHIFT' | 'OFF_SHIFT';
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkerAccountWhereInput = {
      cafeId,
      deletedAt: null,
      role: WorkerRole.WORKER,
    };

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.shiftStatus) {
      where.shiftStatus = query.shiftStatus;
    }

    const [workers, total] = await Promise.all([
      this.prisma.workerAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workerAccount.count({ where }),
    ]);

    return {
      workers,
      total,
      page,
      limit,
    };
  }

  async getWorkerById(cafeId: string, workerId: string) {
    const worker = await this.prisma.workerAccount.findUnique({
      where: { id: workerId },
    });

    if (!worker || worker.deletedAt) {
      throw new NotFoundException('Worker not found');
    }

    if (worker.cafeId !== cafeId) {
      throw new ForbiddenException('Worker does not belong to your cafe');
    }

    return worker;
  }

  async updateWorker(cafeId: string, workerId: string, dto: UpdateWorkerDto) {
    // Validate worker belongs to cafe
    const worker = await this.getWorkerById(cafeId, workerId);

    // Validate email uniqueness if changing
    if (dto.email && dto.email !== worker.email) {
      const existing = await this.prisma.workerAccount.findFirst({
        where: { email: dto.email, deletedAt: null },
      });
      if (existing) {
        throw new BadRequestException('Email already exists');
      }
    }

    // Update in Keycloak if needed
    if (dto.password) {
      // Reset password in Keycloak
      await this.keycloakService.resetPassword(
        worker.keycloakId,
        worker.email,
        dto.password,
      );
    }
    // Note: Keycloak email/name updates would need additional implementation

    // Update in database
    const updated = await this.prisma.workerAccount.update({
      where: { id: workerId },
      data: {
        ...(dto.email && { email: dto.email }),
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
      },
    });

    this.logger.log(`Worker updated: ${updated.email}`);

    return updated;
  }

  async deleteWorker(cafeId: string, workerId: string) {
    // Validate worker belongs to cafe
    const worker = await this.getWorkerById(cafeId, workerId);

    // Soft delete in database
    await this.prisma.workerAccount.update({
      where: { id: workerId },
      data: { deletedAt: new Date() },
    });

    // Deactivate in Keycloak
    try {
      await this.keycloakService.deleteUser(worker.keycloakId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to deactivate user in Keycloak: ${message}`);
      // Continue even if Keycloak fails
    }

    this.logger.log(`Worker deleted: ${worker.email}`);

    return { message: 'Worker deleted successfully' };
  }

  async getShiftSchedule(cafeId: string, workerId: string) {
    await this.getWorkerById(cafeId, workerId);
    const worker = await this.prisma.workerAccount.findUnique({
      where: { id: workerId },
      select: { shiftSchedule: true },
    });
    const absences = await this.prisma.workerScheduleAbsence.findMany({
      where: { workerId },
      orderBy: { startDate: 'asc' },
    });
    return {
      shiftSchedule: worker?.shiftSchedule ?? null,
      absences,
    };
  }

  async updateShiftSchedule(
    cafeId: string,
    workerId: string,
    dto: UpdateWorkerShiftScheduleDto,
  ) {
    await this.getWorkerById(cafeId, workerId);
    const weekly = this.dtoToWeeklySchedule(dto);
    try {
      validateWeeklyShiftSchedule(weekly);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid schedule';
      throw new BadRequestException(msg);
    }

    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { openingHours: true },
    });
    const openingHours = cafe?.openingHours ?? null;
    const violations: { day: WeekdayKey; ymd: string; segment: string }[] = [];
    if (isCafeOpeningHoursSet(openingHours)) {
      for (const day of WEEKDAY_KEYS) {
        const sampleYmd = sampleYmdForWeekdayKey(day);
        const st = weekly[day];
        if (!st || st.closed) continue;
        const bad = workerDayViolatesCafeBounds({
          ymd: sampleYmd,
          weekday: day,
          workerSegments: st.segments,
          cafeOpeningHours: openingHours,
        });
        for (const seg of bad) {
          violations.push({
            day,
            ymd: sampleYmd,
            segment: `${seg.open}-${seg.close}`,
          });
        }
      }
    }

    const json = this.weeklyToJson(weekly) as Prisma.InputJsonValue;
    await this.prisma.workerAccount.update({
      where: { id: workerId },
      data: { shiftSchedule: json },
    });
    return {
      shiftSchedule: json,
      cafeBoundsViolations: violations,
    };
  }

  async listScheduleAbsences(cafeId: string, workerId: string) {
    await this.getWorkerById(cafeId, workerId);
    return this.prisma.workerScheduleAbsence.findMany({
      where: { workerId },
      orderBy: { startDate: 'asc' },
    });
  }

  async createScheduleAbsence(
    cafeId: string,
    workerId: string,
    dto: CreateWorkerScheduleAbsenceDto,
    createdByWorkerId?: string,
  ) {
    await this.getWorkerById(cafeId, workerId);
    if (dto.endYmd < dto.startYmd) {
      throw new BadRequestException('endYmd must be >= startYmd');
    }
    const startDate = this.ymdToMskMidnightUtc(dto.startYmd);
    const endDate = this.ymdToMskMidnightUtc(dto.endYmd);
    return this.prisma.workerScheduleAbsence.create({
      data: {
        workerId,
        startDate,
        endDate,
        kind: dto.kind,
        createdByWorkerId: createdByWorkerId ?? null,
      },
    });
  }

  async deleteScheduleAbsence(
    cafeId: string,
    workerId: string,
    absenceId: string,
  ) {
    await this.getWorkerById(cafeId, workerId);
    const row = await this.prisma.workerScheduleAbsence.findUnique({
      where: { id: absenceId },
    });
    if (!row || row.workerId !== workerId) {
      throw new NotFoundException('Absence not found');
    }
    await this.prisma.workerScheduleAbsence.delete({
      where: { id: absenceId },
    });
    return { ok: true };
  }

  private ymdToMskMidnightUtc(ymd: string): Date {
    const [y, mo, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0) - 3 * 60 * 60 * 1000);
  }

  private dtoToWeeklySchedule(
    dto: UpdateWorkerShiftScheduleDto,
  ): WeeklyShiftSchedule {
    const out: WeeklyShiftSchedule = {};
    for (const day of WEEKDAY_KEYS) {
      const v = dto[day];
      if (!v) {
        throw new BadRequestException(`Missing schedule for ${day}`);
      }
      if (v.closed === true) {
        out[day] = { closed: true };
        continue;
      }
      if (v.segments && v.segments.length > 0) {
        out[day] = {
          closed: false,
          segments: v.segments.map((s) => ({ open: s.open, close: s.close })),
        };
        continue;
      }
      if (v.open && v.close) {
        out[day] = {
          closed: false,
          segments: [{ open: v.open, close: v.close }],
        };
        continue;
      }
      throw new BadRequestException(
        `Segments or open/close required for ${day} when not closed`,
      );
    }
    return out;
  }

  private weeklyToJson(weekly: WeeklyShiftSchedule): Prisma.JsonObject {
    const o: Prisma.JsonObject = {};
    for (const day of WEEKDAY_KEYS) {
      const st = weekly[day];
      if (!st) continue;
      if (st.closed) {
        o[day] = { closed: true };
      } else {
        o[day] = { segments: st.segments };
      }
    }
    return o;
  }
}
