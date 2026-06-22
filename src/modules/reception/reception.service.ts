import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkerRole } from '@prisma/client';
import {
  mskAddDays,
  mskMidnightUtc,
  mskYmdFromDate,
} from '../../common/worker-schedule/worker-schedule.lib';
import { parseScudQrPayload } from '../../common/guest/scud-qr.lib';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import { GuestsService } from '../guests/guests.service';

@Injectable()
export class ReceptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workersService: WorkersService,
    private readonly guestsService: GuestsService,
  ) {}

  private async resolveWorkerCafeId(ctx: {
    keycloakId: string;
    workerId?: string;
    cafeId?: string;
    fallbackCafeId?: string;
  }): Promise<string> {
    if (ctx.cafeId) return ctx.cafeId;

    if (ctx.workerId) {
      const selected = await this.prisma.workerAccount.findFirst({
        where: { id: ctx.workerId, deletedAt: null },
      });
      if (selected?.cafeId) return selected.cafeId;
    }

    if (ctx.fallbackCafeId && ctx.workerId) {
      const match = await this.prisma.workerAccount.findFirst({
        where: {
          id: ctx.workerId,
          deletedAt: null,
          cafeId: ctx.fallbackCafeId,
        },
      });
      if (match) return ctx.fallbackCafeId;
    }

    const worker = await this.workersService.findByKeycloakId(ctx.keycloakId);
    if (!worker) {
      throw new ForbiddenException('Требуется учётная запись сотрудника');
    }
    if (worker.cafeId) return worker.cafeId;

    if (
      worker.role === WorkerRole.SYSTEM_ADMIN ||
      worker.role === WorkerRole.BRAND_ADMIN ||
      worker.role === WorkerRole.CAFE_ADMIN
    ) {
      throw new BadRequestException(
        'Выберите учётную запись сотрудника кафе (переключите роль в меню входа)',
      );
    }
    throw new BadRequestException('Сотрудник не привязан к кафе');
  }

  private todayMskBounds() {
    const ymd = mskYmdFromDate(new Date());
    const start = mskMidnightUtc(ymd);
    const end = mskMidnightUtc(mskAddDays(ymd, 1));
    return { start, end };
  }

  private async findTodayAppointments(userId: string | null, cafeId: string) {
    if (!userId) return [];
    const { start, end } = this.todayMskBounds();
    return this.prisma.appointment.findMany({
      where: {
        userId,
        cafeId,
        dateTime: { gte: start, lt: end },
        status: { notIn: ['cancelled'] },
      },
      include: {
        room: { select: { id: true, name: true } },
        cafe: { select: { id: true, name: true } },
      },
      orderBy: { dateTime: 'asc' },
    });
  }

  private mapAppointment(a: {
    id: string;
    dateTime: Date;
    duration: number;
    status: string;
    notes: string | null;
    room: { id: string; name: string } | null;
    cafe: { id: string; name: string };
  }) {
    return {
      id: a.id,
      dateTime: a.dateTime,
      duration: a.duration,
      status: a.status,
      notes: a.notes,
      room: a.room,
      cafe: a.cafe,
    };
  }

  async scan(
    ctx: {
      keycloakId: string;
      workerId?: string;
      cafeId?: string;
      fallbackCafeId?: string;
    },
    accessCardNumber?: string,
    payload?: string,
    phone?: string,
  ) {
    let card = accessCardNumber?.trim();
    if (!card && payload) {
      card = parseScudQrPayload(payload) ?? undefined;
    }
    const guestRecord = await this.guestsService.lookupByCardOrPhone(
      card,
      phone?.trim(),
    );
    const cafeId = await this.resolveWorkerCafeId(ctx);
    const appointmentsToday = await this.findTodayAppointments(
      guestRecord.userId,
      cafeId,
    );
    const mapped = appointmentsToday.map((a) => this.mapAppointment(a));
    return {
      guest: this.guestsService.mapGuestPublic(guestRecord),
      appointmentsToday: mapped,
      openAppointmentId: mapped.length === 1 ? mapped[0].id : undefined,
    };
  }

  async guestAppointmentsToday(
    ctx: {
      keycloakId: string;
      workerId?: string;
      cafeId?: string;
      fallbackCafeId?: string;
    },
    guestId: string,
  ) {
    const cafeId = await this.resolveWorkerCafeId(ctx);
    const guest = await this.prisma.networkGuest.findUnique({
      where: { id: guestId },
      include: {
        loyaltyTier: true,
        registrationCafe: true,
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    if (!guest) throw new NotFoundException('Клиент не найден');
    const appointmentsToday = await this.findTodayAppointments(
      guest.userId,
      cafeId,
    );
    const mapped = appointmentsToday.map((a) => this.mapAppointment(a));
    return {
      guest: this.guestsService.mapGuestPublic(guest),
      appointmentsToday: mapped,
      openAppointmentId: mapped.length === 1 ? mapped[0].id : undefined,
    };
  }
}
