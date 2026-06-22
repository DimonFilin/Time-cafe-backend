import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { FileValidator } from '../storage/utils/file-validator';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, LogSeverity } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CafeRealtimeGateway } from '../cafe-realtime/cafe-realtime.gateway';
import {
  parseWorkerShiftSchedule,
  isWeeklyShiftScheduleEmpty,
  isCafeOpeningHoursSet,
  buildEffectiveScheduleWindow,
  mskYmdFromDate,
  mskAddDays,
  needsConfirmShiftOn,
  needsConfirmShiftOff,
} from '../../common/worker-schedule/worker-schedule.lib';

@Injectable()
export class CafeWorkerService {
  constructor(
    private prisma: PrismaService,
    private activityLogsService: ActivityLogsService,
    private storageService: StorageService,
    private cafeRealtime: CafeRealtimeGateway,
  ) {}

  private parseStorageRef(
    input: string,
  ): { bucket: string; key: string } | null {
    const raw = String(input || '').trim();
    if (!raw) return null;
    const direct = raw.match(/^(users|public|brands|cafes)\/(.+)$/);
    if (direct) return { bucket: direct[1], key: direct[2] };
    const urlMatch = raw.match(/\/(users|public|brands|cafes)\/(.+)$/);
    if (urlMatch)
      return { bucket: urlMatch[1], key: decodeURIComponent(urlMatch[2]) };
    return null;
  }

  async resolveAvatarUrl(avatar: string | null): Promise<string | null> {
    if (!avatar) return null;
    const ref = this.parseStorageRef(avatar);
    if (!ref) {
      return /^https?:\/\//i.test(avatar) ? avatar : null;
    }
    try {
      return await this.storageService.getFileUrl(ref.bucket, ref.key);
    } catch {
      return null;
    }
  }

  async getMe(workerId: string) {
    const worker = await this.prisma.workerAccount.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        shiftStatus: true,
        avatar: true,
        birthDate: true,
        brandId: true,
        cafeId: true,
        brand: { select: { id: true, name: true } },
        cafe: { select: { id: true, name: true, address: true } },
      },
    });
    if (!worker) {
      throw new NotFoundException('Worker not found');
    }
    const avatarUrl = await this.resolveAvatarUrl(worker.avatar);
    return {
      ...worker,
      birthDate: worker.birthDate
        ? worker.birthDate.toISOString().slice(0, 10)
        : null,
      avatarUrl,
    };
  }

  async updateMyProfile(workerId: string, dto: UpdateWorkerProfileDto) {
    const data: {
      firstName?: string;
      lastName?: string;
      avatar?: string | null;
      birthDate?: Date | null;
    } = {};
    if (dto.firstName !== undefined) {
      const firstName = dto.firstName.trim();
      if (!firstName) {
        throw new BadRequestException('firstName is required');
      }
      data.firstName = firstName;
    }
    if (dto.lastName !== undefined) {
      const lastName = dto.lastName.trim();
      if (!lastName) {
        throw new BadRequestException('lastName is required');
      }
      data.lastName = lastName;
    }
    if (dto.avatar !== undefined) {
      data.avatar = dto.avatar?.trim() || null;
    }
    if (dto.birthDate !== undefined) {
      if (dto.birthDate === null || dto.birthDate === '') {
        data.birthDate = null;
      } else {
        const parsed = new Date(`${dto.birthDate}T12:00:00.000Z`);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException('Invalid birthDate');
        }
        data.birthDate = parsed;
      }
    }
    if (!Object.keys(data).length) {
      return this.getMe(workerId);
    }
    await this.prisma.workerAccount.update({
      where: { id: workerId },
      data,
    });
    return this.getMe(workerId);
  }

  async uploadMyAvatar(
    workerId: string,
    file: {
      buffer: Buffer;
      mimetype: string;
      size: number;
      originalname?: string;
    },
  ) {
    const worker = await this.prisma.workerAccount.findUnique({
      where: { id: workerId },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Worker not found');
    }

    FileValidator.validateImage(file);

    const original = (file.originalname || 'avatar').trim();
    const safeName = original.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
    const fileName = `${Date.now()}-${safeName || 'avatar'}`;
    const buckets = this.storageService.getBuckets();
    const path = `workers/${worker.id}/avatar/${fileName}`;

    const uploaded = await this.storageService.uploadFile(
      buckets.public,
      path,
      file,
      { workerId: worker.id, kind: 'avatar' },
    );

    const stableAvatarRef = `${buckets.public}/${uploaded.path}`;
    await this.prisma.workerAccount.update({
      where: { id: workerId },
      data: { avatar: stableAvatarRef },
    });
    return this.getMe(workerId);
  }

  // Получить заказы кафе
  async getOrders(cafeId: string, statuses?: OrderStatus[]) {
    const orders = await this.prisma.order.findMany({
      where: {
        cafeId,
        status: statuses ? { in: statuses } : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        items: {
          select: {
            id: true,
            itemName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            notes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return {
      orders,
      total: orders.length,
    };
  }

  // Получить детали заказа
  async getOrderById(orderId: string, cafeId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        cafeId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            itemName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            notes: true,
          },
        },
        transactions: {
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  // Подтвердить заказ
  async confirmOrder(orderId: string, cafeId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        cafeId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new ForbiddenException('Order cannot be confirmed');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        items: true,
      },
    });
    this.cafeRealtime.emitOrderUpdated(cafeId, updated);
    return updated;
  }

  // Завершить заказ
  async completeOrder(orderId: string, cafeId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        cafeId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'CONFIRMED') {
      throw new ForbiddenException('Order cannot be completed');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        items: true,
      },
    });
    this.cafeRealtime.emitOrderUpdated(cafeId, updated);
    return updated;
  }

  // Отменить заказ
  async cancelOrder(orderId: string, cafeId: string, reason: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        cafeId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ForbiddenException('Order cannot be cancelled');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        items: true,
      },
    });
    this.cafeRealtime.emitOrderUpdated(cafeId, updated);
    return updated;
  }

  async getMySchedule(workerId: string) {
    const worker = await this.prisma.workerAccount.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        shiftSchedule: true,
        cafeId: true,
        cafe: { select: { id: true, name: true, openingHours: true } },
        scheduleAbsences: {
          orderBy: { startDate: 'asc' },
        },
      },
    });
    if (!worker) {
      throw new NotFoundException('Worker not found');
    }
    const openingHours = worker.cafe?.openingHours ?? null;
    const cafeSet = isCafeOpeningHoursSet(openingHours);
    const todayMsk = mskYmdFromDate(new Date());
    const fromYmd = mskAddDays(todayMsk, -1);
    const workerParsed = parseWorkerShiftSchedule(worker.shiftSchedule);
    const segments = buildEffectiveScheduleWindow({
      fromYmd,
      days: 16,
      workerSchedule: workerParsed,
      cafeOpeningHours: openingHours,
      absences: worker.scheduleAbsences.map((a) => ({
        startDate: a.startDate,
        endDate: a.endDate,
      })),
    });
    return {
      todayMsk,
      cafeScheduleStatus: cafeSet ? 'SET' : 'NOT_SET',
      cafe: worker.cafe ? { id: worker.cafe.id, name: worker.cafe.name } : null,
      shiftSchedule: worker.shiftSchedule,
      absences: worker.scheduleAbsences,
      effectiveSegments: segments,
    };
  }

  // Переключить статус смены работника
  async toggleShiftStatus(
    workerId: string,
    dto?: { confirmOutsideSchedule?: boolean },
  ) {
    const worker = await this.prisma.workerAccount.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        shiftStatus: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        brandId: true,
        cafeId: true,
        shiftSchedule: true,
        cafe: { select: { openingHours: true } },
        scheduleAbsences: true,
      },
    });

    if (!worker) {
      throw new NotFoundException('Worker not found');
    }

    const goingOnShift = worker.shiftStatus === 'OFF_SHIFT';
    const openingHours = worker.cafe?.openingHours ?? null;
    const workerParsed = parseWorkerShiftSchedule(worker.shiftSchedule);
    const cafeSet = isCafeOpeningHoursSet(openingHours);
    const workerEmpty = isWeeklyShiftScheduleEmpty(workerParsed);
    const skipScheduleConfirm = !cafeSet && workerEmpty;

    if (!skipScheduleConfirm) {
      const todayMsk = mskYmdFromDate(new Date());
      const fromYmd = mskAddDays(todayMsk, -1);
      const eff = buildEffectiveScheduleWindow({
        fromYmd,
        days: 3,
        workerSchedule: workerParsed,
        cafeOpeningHours: openingHours,
        absences: worker.scheduleAbsences.map((a) => ({
          startDate: a.startDate,
          endDate: a.endDate,
        })),
      });
      if (eff.length > 0) {
        const now = new Date();
        const need = goingOnShift
          ? needsConfirmShiftOn(now, eff)
          : needsConfirmShiftOff(now, eff);
        if (need && !dto?.confirmOutsideSchedule) {
          throw new HttpException(
            {
              requireConfirm: true,
              code: 'SHIFT_OUTSIDE_SCHEDULE_WINDOW',
              message:
                'Подтвердите переключение смены: время вне окна ±10 минут от графика.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }
    }

    const newStatus =
      worker.shiftStatus === 'ON_SHIFT' ? 'OFF_SHIFT' : 'ON_SHIFT';

    const updatedWorker = await this.prisma.workerAccount.update({
      where: { id: workerId },
      data: { shiftStatus: newStatus },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        shiftStatus: true,
      },
    });

    const message =
      newStatus === 'ON_SHIFT' ? 'Вы начали смену' : 'Вы завершили смену';

    // Создаём лог активности
    await this.activityLogsService.log({
      workerId: worker.id,
      workerEmail: worker.email,
      workerRole: worker.role,
      brandId: worker.brandId ?? undefined,
      cafeId: worker.cafeId ?? undefined,
      action: 'UPDATE',
      category: 'DATA',
      severity: LogSeverity.INFO,
      resourceType: 'WORKER',
      resourceId: worker.id,
      details: {
        shiftStatus: newStatus,
        message,
        action: newStatus === 'ON_SHIFT' ? 'START_SHIFT' : 'END_SHIFT',
        previousStatus: worker.shiftStatus,
      },
      endpoint: '/cafe-worker/shift-status',
      method: 'PATCH',
      statusCode: 200,
    });

    return {
      ...updatedWorker,
      message,
    };
  }
}
