import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { WorkersService } from '../workers/workers.service';
import { BalanceService } from '../payments/services/balance.service';
import { TransactionsService } from '../payments/services/transactions.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { AppointmentResponseDto } from './dto/appointment-response.dto';
import { AppointmentListResponseDto } from './dto/appointment-list-response.dto';
import { AppointmentListQueryDto } from './dto/appointment-list-query.dto';
import {
  Prisma,
  WorkerRole,
  ActivityAction,
  ActivityCategory,
} from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CafeRealtimeGateway } from '../cafe-realtime/cafe-realtime.gateway';
import {
  billingModesAvailable,
  calculateRoomBookingPrice,
  parseRoomBilling,
  type RoomBillingMode,
} from '../cafe-layout/room-billing.util';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly workersService: WorkersService,
    private readonly balanceService: BalanceService,
    private readonly transactionsService: TransactionsService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly cafeRealtime: CafeRealtimeGateway,
  ) {}

  private publishAppointmentUpdate(
    cafeId: string,
    appointment: AppointmentResponseDto,
  ) {
    try {
      this.cafeRealtime.emitAppointmentUpdated(cafeId, appointment);
    } catch (error) {
      this.logger.warn(`Failed to emit appointment update: ${String(error)}`);
    }
  }

  private async logCafeStaffAppointment(
    keycloakId: string,
    params: {
      action: ActivityAction;
      category: ActivityCategory;
      resourceType: string;
      resourceId: string;
      details?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) return;
    await this.activityLogsService.log({
      workerId: worker.id,
      workerEmail: worker.email,
      workerRole: worker.role,
      brandId: worker.brandId ?? undefined,
      cafeId: worker.cafeId ?? undefined,
      action: params.action,
      category: params.category,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      details: params.details,
    });
  }

  /**
   * Generate QR code for appointment
   */
  private generateQrCode(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15).toUpperCase()
    );
  }

  /**
   * Check if time slot is available
   */
  private async checkTimeSlotAvailability(
    cafeId: string,
    dateTime: Date,
    duration: number,
    excludeAppointmentId?: string,
  ): Promise<void> {
    const endTime = new Date(dateTime.getTime() + duration * 60000);

    // Check for overlapping appointments
    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        cafeId,
        status: { in: ['pending', 'confirmed'] },
        OR: [
          {
            AND: [
              { dateTime: { lte: dateTime } },
              {
                dateTime: {
                  gte: new Date(dateTime.getTime() - duration * 60000),
                },
              },
            ],
          },
          {
            AND: [
              { dateTime: { gte: dateTime } },
              { dateTime: { lt: endTime } },
            ],
          },
        ],
        ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
      },
    });

    if (overlapping) {
      throw new ConflictException('Time slot is not available');
    }
  }

  private rangesOverlap(
    aStart: Date,
    aDurationMin: number,
    bStart: Date,
    bDurationMin: number,
  ) {
    const aEnd = new Date(aStart.getTime() + aDurationMin * 60000);
    const bEnd = new Date(bStart.getTime() + bDurationMin * 60000);
    return aStart < bEnd && bStart < aEnd;
  }

  private async checkRoomAvailability(
    roomId: string,
    dateTime: Date,
    duration: number,
    excludeAppointmentId?: string,
  ) {
    const from = new Date(dateTime.getTime() - 24 * 60 * 60000);
    const to = new Date(dateTime.getTime() + 24 * 60 * 60000);
    const candidates = await this.prisma.appointment.findMany({
      where: {
        roomId,
        status: { in: ['pending', 'confirmed'] },
        dateTime: { gte: from, lte: to },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { dateTime: true, duration: true },
    });
    const conflict = candidates.some((c) =>
      this.rangesOverlap(dateTime, duration, c.dateTime, c.duration),
    );
    if (conflict) {
      throw new ConflictException('Room time slot is not available');
    }
  }

  private async reserveSharedAssetsForAppointment(params: {
    appointmentId: string;
    cafeId: string;
    roomId: string;
    dateTime: Date;
    duration: number;
    selectedSharedAssetIds?: string[];
  }) {
    const ids = params.selectedSharedAssetIds ?? [];
    if (!ids.length) return;
    const endAt = new Date(params.dateTime.getTime() + params.duration * 60000);
    await this.prisma.$transaction(async (tx) => {
      for (const assetId of ids) {
        const asset = await tx.cafeSharedAsset.findFirst({
          where: { id: assetId, cafeId: params.cafeId, isActive: true },
        });
        if (!asset)
          throw new BadRequestException(`Shared asset not found: ${assetId}`);
        const reservations = await tx.cafeSharedAssetReservation.findMany({
          where: {
            sharedAssetId: assetId,
            startAt: { lt: endAt },
            endAt: { gt: params.dateTime },
          },
          select: { quantity: true },
        });
        const reserved = reservations.reduce((sum, r) => sum + r.quantity, 0);
        if (reserved + 1 > asset.totalQuantity) {
          throw new ConflictException(
            `Shared asset is unavailable for selected slot: ${asset.name}`,
          );
        }
        await tx.cafeSharedAssetReservation.create({
          data: {
            cafeId: params.cafeId,
            sharedAssetId: assetId,
            appointmentId: params.appointmentId,
            roomId: params.roomId,
            startAt: params.dateTime,
            endAt,
            quantity: 1,
          },
        });
      }
    });
  }

  private resolveBillingMode(
    requested: RoomBillingMode | undefined,
    settings: ReturnType<typeof parseRoomBilling>,
  ): RoomBillingMode {
    const modes = billingModesAvailable(settings);
    if (!modes.length) {
      throw new BadRequestException('Room has no billing modes configured');
    }
    if (requested && modes.includes(requested)) return requested;
    if (modes.includes('HOURLY')) return 'HOURLY';
    return modes[0];
  }

  private calculateAppointmentCost(
    duration: number,
    billingMode: RoomBillingMode,
    settings: ReturnType<typeof parseRoomBilling>,
  ): number {
    return calculateRoomBookingPrice(duration, billingMode, settings);
  }

  /**
   * Create appointment
   */
  async create(
    keycloakId: string,
    createDto: CreateAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate cafe exists and is active
    const cafe = await this.prisma.cafe.findFirst({
      where: {
        id: createDto.cafeId,
        deletedAt: null,
      },
      include: {
        brand: {
          select: {
            status: true,
            isVerified: true,
          },
        },
      },
    });

    if (!cafe) {
      throw new NotFoundException('Cafe not found');
    }

    if (cafe.brand.status !== 'ACTIVE' || !cafe.brand.isVerified) {
      throw new BadRequestException('Cafe is not available for appointments');
    }

    const dateTime = new Date(createDto.dateTime);

    // Validate date is not in the past
    if (dateTime <= new Date()) {
      throw new BadRequestException('Appointment date must be in the future');
    }

    const room = await this.prisma.cafeRoom.findFirst({
      where: {
        id: createDto.roomId,
        cafeId: createDto.cafeId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        capacity: true,
        metadata: true,
      },
    });
    if (!room) {
      throw new BadRequestException('Room not found in selected cafe');
    }
    await this.checkRoomAvailability(
      createDto.roomId,
      dateTime,
      createDto.duration,
    );

    const billing = parseRoomBilling(room.metadata);
    const billingMode = this.resolveBillingMode(createDto.billingMode, billing);
    const totalAmount = this.calculateAppointmentCost(
      createDto.duration,
      billingMode,
      billing,
    );

    // Handle payment if required
    let transactionId: string | undefined;

    if (totalAmount > 0 && createDto.paymentMethod) {
      if (createDto.paymentMethod === 'CARD' && !createDto.cardId) {
        throw new BadRequestException('Card ID is required for card payment');
      }

      if (createDto.paymentMethod === 'BALANCE') {
        await this.balanceService.deductFromBalance(user.id, totalAmount);
      } else if (createDto.paymentMethod === 'CARD' && createDto.cardId) {
        // Create payment transaction
        const transaction = await this.transactionsService.createPayment(
          user.id,
          createDto.cardId,
          totalAmount,
          undefined, // no orderId
          `Payment for appointment at ${cafe.name}`,
        );
        transactionId = transaction.id;
      }
      // For CASH, payment will be made at the cafe
    }

    // Create appointment
    const appointment = await this.prisma.appointment.create({
      data: {
        userId: user.id,
        cafeId: createDto.cafeId,
        roomId: createDto.roomId,
        dateTime,
        duration: createDto.duration,
        totalAmount,
        paymentMethod: createDto.paymentMethod,
        transactionId,
        qrCode: this.generateQrCode(),
        notes: createDto.notes,
        roomSnapshot: {
          id: room.id,
          name: room.name,
          description: room.description,
          imageUrl: room.imageUrl,
          capacity: room.capacity,
          billing,
          billingMode,
        },
        selectedAssets: {
          sharedAssetIds: createDto.selectedSharedAssetIds ?? [],
        },
      },
      include: {
        cafe: {
          select: {
            name: true,
          },
        },
        room: {
          select: { id: true, name: true },
        },
      },
    });

    await this.reserveSharedAssetsForAppointment({
      appointmentId: appointment.id,
      cafeId: createDto.cafeId,
      roomId: createDto.roomId,
      dateTime,
      duration: createDto.duration,
      selectedSharedAssetIds: createDto.selectedSharedAssetIds,
    });

    this.logger.log(
      `Appointment created: ${appointment.id} for user ${user.id} at cafe ${cafe.name}`,
    );

    const created = this.mapToResponseDto(appointment);
    this.publishAppointmentUpdate(createDto.cafeId, created);
    return created;
  }

  /**
   * Get user's appointments
   */
  async findUserAppointments(
    keycloakId: string,
    query: AppointmentListQueryDto,
  ): Promise<AppointmentListResponseDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AppointmentWhereInput = {
      userId: user.id,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.cafeId) {
      where.cafeId = query.cafeId;
    }

    if (query.from || query.to) {
      where.dateTime = {};
      if (query.from) {
        where.dateTime.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        where.dateTime.lte = toDate;
      }
    }

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          cafe: {
            select: {
              name: true,
            },
          },
          room: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { dateTime: 'desc' },
        take: limit,
        skip,
      }) as Promise<any[]>,
      this.prisma.appointment.count({ where }),
    ]);

    return {
      items: appointments.map((appointment) =>
        this.mapToResponseDto(appointment),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get appointment by ID
   */
  async findOne(
    appointmentId: string,
    keycloakId: string,
  ): Promise<AppointmentResponseDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        userId: user.id,
      },
      include: {
        cafe: {
          select: {
            name: true,
          },
        },
        room: { select: { id: true, name: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return this.mapToResponseDto(appointment);
  }

  /**
   * Update appointment
   */
  async update(
    appointmentId: string,
    keycloakId: string,
    updateDto: UpdateAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        userId: user.id,
      },
      include: {
        cafe: {
          select: {
            name: true,
          },
        },
        room: { select: { id: true, name: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Can only update pending appointments
    if (appointment.status !== 'pending') {
      throw new BadRequestException('Only pending appointments can be updated');
    }

    // Validate new time if provided
    if (updateDto.dateTime) {
      const newDateTime = new Date(updateDto.dateTime);
      if (newDateTime <= new Date()) {
        throw new BadRequestException('Appointment date must be in the future');
      }

      // Temporarily disabled: time slot availability check
      // await this.checkTimeSlotAvailability(
      //   appointment.cafeId,
      //   newDateTime,
      //   updateDto.duration || appointment.duration,
      //   appointmentId,
      // );
    }

    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...(updateDto.dateTime && { dateTime: new Date(updateDto.dateTime) }),
        ...(updateDto.duration && { duration: updateDto.duration }),
        ...(updateDto.notes !== undefined && { notes: updateDto.notes }),
      },
      include: {
        cafe: {
          select: {
            name: true,
          },
        },
        room: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Appointment updated: ${appointmentId}`);

    const updated = this.mapToResponseDto(updatedAppointment);
    this.publishAppointmentUpdate(updatedAppointment.cafeId, updated);
    return updated;
  }

  /**
   * Cancel appointment
   */
  async cancel(
    appointmentId: string,
    keycloakId: string,
    cancelDto?: CancelAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        userId: user.id,
      },
      include: {
        cafe: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Can only cancel pending or confirmed appointments
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      throw new BadRequestException(
        'Only pending or confirmed appointments can be cancelled',
      );
    }

    // Refund if paid
    if (
      appointment.totalAmount &&
      Number(appointment.totalAmount) > 0 &&
      appointment.transactionId &&
      appointment.paymentMethod !== 'CASH'
    ) {
      try {
        if (appointment.paymentMethod === 'BALANCE') {
          await this.balanceService.addToBalance(
            user.id,
            Number(appointment.totalAmount),
          );
        } else {
          // Refund to card
          await this.transactionsService.createRefund(
            user.id,
            appointment.transactionId,
            Number(appointment.totalAmount),
            `Refund for cancelled appointment at ${appointment.cafe.name}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to refund appointment ${appointmentId}: ${error}`,
        );
      }
    }

    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'cancelled',
        notes: cancelDto?.reason
          ? `Cancelled: ${cancelDto.reason}`
          : 'Cancelled by user',
      },
      include: {
        cafe: {
          select: {
            name: true,
          },
        },
      },
    });

    this.logger.log(`Appointment cancelled: ${appointmentId}`);

    const cancelled = this.mapToResponseDto(updatedAppointment);
    this.publishAppointmentUpdate(updatedAppointment.cafeId, cancelled);
    return cancelled;
  }

  /**
   * Get cafe appointments (for workers)
   */
  async findCafeAppointments(
    cafeId: string,
    keycloakId: string,
    query: AppointmentListQueryDto,
  ): Promise<AppointmentListResponseDto> {
    // Check access
    await this.checkCafeAccess(cafeId, keycloakId);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AppointmentWhereInput = {
      cafeId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.from || query.to) {
      where.dateTime = {};
      if (query.from) {
        where.dateTime.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        where.dateTime.lte = toDate;
      }
    }

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          cafe: {
            select: {
              name: true,
            },
          },
          room: { select: { id: true, name: true } },
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          orders: { select: { id: true } },
        },
        orderBy: { dateTime: 'desc' },
        take: limit,
        skip,
      }) as Promise<any[]>,
      this.prisma.appointment.count({ where }),
    ]);

    await this.logCafeStaffAppointment(keycloakId, {
      action: ActivityAction.VIEW_LIST,
      category: ActivityCategory.VIEW,
      resourceType: 'APPOINTMENT',
      resourceId: cafeId,
      details: { page, limit, status: query.status },
    });

    return {
      items: appointments.map((appointment) =>
        this.mapToResponseDto(appointment),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get cafe appointment by ID (for workers)
   */
  async findCafeAppointment(
    appointmentId: string,
    keycloakId: string,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        cafe: {
          select: {
            name: true,
          },
        },
        room: { select: { id: true, name: true } },
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        orders: { select: { id: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Check access
    await this.checkCafeAccess(appointment.cafeId, keycloakId);

    await this.logCafeStaffAppointment(keycloakId, {
      action: ActivityAction.VIEW_DETAIL,
      category: ActivityCategory.VIEW,
      resourceType: 'APPOINTMENT',
      resourceId: appointmentId,
      details: { cafeId: appointment.cafeId },
    });

    return this.mapToResponseDto(appointment);
  }

  /**
   * Confirm appointment (for cafe workers)
   */
  async confirmAppointment(
    appointmentId: string,
    keycloakId: string,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        cafe: {
          select: {
            name: true,
          },
        },
        room: { select: { id: true, name: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Check access
    await this.checkCafeAccess(appointment.cafeId, keycloakId);

    if (appointment.status !== 'pending') {
      throw new BadRequestException(
        'Only pending appointments can be confirmed',
      );
    }

    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'confirmed' },
      include: {
        cafe: { select: { name: true } },
        room: { select: { id: true, name: true } },
        orders: { select: { id: true } },
      },
    });

    this.logger.log(`Appointment confirmed: ${appointmentId}`);

    await this.logCafeStaffAppointment(keycloakId, {
      action: ActivityAction.UPDATE,
      category: ActivityCategory.DATA,
      resourceType: 'APPOINTMENT',
      resourceId: appointmentId,
      details: { status: 'confirmed', cafeId: appointment.cafeId },
    });

    const confirmed = this.mapToResponseDto(updatedAppointment);
    this.publishAppointmentUpdate(appointment.cafeId, confirmed);
    return confirmed;
  }

  /**
   * Check-in appointment (for cafe workers)
   */
  async checkInAppointment(
    appointmentId: string,
    keycloakId: string,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        cafe: { select: { name: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.checkCafeAccess(appointment.cafeId, keycloakId);

    if (appointment.status !== 'confirmed') {
      throw new BadRequestException(
        'Only confirmed appointments can be checked in',
      );
    }

    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'completed' },
      include: {
        cafe: { select: { name: true } },
        room: { select: { id: true, name: true } },
        orders: { select: { id: true } },
      },
    });

    this.logger.log(`Appointment checked in: ${appointmentId}`);

    await this.logCafeStaffAppointment(keycloakId, {
      action: ActivityAction.UPDATE,
      category: ActivityCategory.DATA,
      resourceType: 'APPOINTMENT',
      resourceId: appointmentId,
      details: { status: 'completed', cafeId: appointment.cafeId },
    });

    const checkedIn = this.mapToResponseDto(updatedAppointment);
    this.publishAppointmentUpdate(appointment.cafeId, checkedIn);
    return checkedIn;
  }

  /**
   * Cancel appointment (for cafe workers)
   */
  async cancelCafeAppointment(
    appointmentId: string,
    keycloakId: string,
    cancelDto?: CancelAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        cafe: { select: { name: true } },
        room: { select: { id: true, name: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.checkCafeAccess(appointment.cafeId, keycloakId);

    if (!['pending', 'confirmed'].includes(appointment.status)) {
      throw new BadRequestException(
        'Only pending or confirmed appointments can be cancelled',
      );
    }

    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'cancelled',
        notes: cancelDto?.reason
          ? `Cancelled: ${cancelDto.reason}`
          : 'Cancelled by cafe worker',
      },
      include: {
        cafe: { select: { name: true } },
        room: { select: { id: true, name: true } },
        orders: { select: { id: true } },
      },
    });

    this.logger.log(`Appointment cancelled by cafe: ${appointmentId}`);

    await this.logCafeStaffAppointment(keycloakId, {
      action: ActivityAction.UPDATE,
      category: ActivityCategory.DATA,
      resourceType: 'APPOINTMENT',
      resourceId: appointmentId,
      details: { status: 'cancelled', cafeId: appointment.cafeId },
    });

    const cancelledByCafe = this.mapToResponseDto(updatedAppointment);
    this.publishAppointmentUpdate(appointment.cafeId, cancelledByCafe);
    return cancelledByCafe;
  }

  /**
   * Check if user has access to cafe appointments (for workers)
   */
  private async checkCafeAccess(
    cafeId: string,
    keycloakId: string,
  ): Promise<void> {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) {
      throw new ForbiddenException('Worker account not found');
    }

    if (worker.role === WorkerRole.SYSTEM_ADMIN) {
      return;
    }

    if (worker.role === WorkerRole.BRAND_ADMIN) {
      // Check if cafe belongs to worker's brand
      const cafe = await this.prisma.cafe.findUnique({
        where: { id: cafeId },
        select: { brandId: true },
      });
      if (cafe?.brandId === worker.brandId) {
        return;
      }
    }

    if (
      (worker.role === WorkerRole.CAFE_ADMIN ||
        worker.role === WorkerRole.WORKER) &&
      worker.cafeId === cafeId
    ) {
      return;
    }

    throw new ForbiddenException(
      'Only SYSTEM_ADMIN, BRAND_ADMIN, CAFE_ADMIN, or WORKER of this cafe can perform this action',
    );
  }

  /**
   * Map appointment to response DTO
   */

  private mapToResponseDto(appointment: unknown): AppointmentResponseDto {
    const app = appointment as {
      id: string;
      userId: string;
      user?: {
        firstName?: string;
        lastName?: string;
        phone?: string | null;
        email?: string | null;
      };
      cafeId: string;
      cafe?: { name?: string };
      roomId?: string | null;
      room?: { id?: string; name?: string };
      dateTime: Date;
      duration: number;
      status: string;
      qrCode: string;
      totalAmount: unknown;
      paymentMethod: string;
      transactionId: string;
      orders?: Array<{ id: string }>;
      notes: string;
      roomSnapshot?: unknown;
      selectedAssets?: unknown;
      createdAt: Date;
      updatedAt: Date;
    };

    const orderIds = Array.isArray(app.orders)
      ? app.orders.map((o) => o.id).filter(Boolean)
      : [];
    const orderId = orderIds.length ? orderIds[orderIds.length - 1] : undefined;

    return {
      id: app.id,
      userId: app.userId,
      user:
        app.user?.firstName ||
        app.user?.lastName ||
        app.user?.email ||
        app.user?.phone
          ? {
              firstName: app.user?.firstName ?? '',
              lastName: app.user?.lastName ?? '',
              ...(app.user?.email ? { email: app.user.email } : {}),
              ...(app.user?.phone ? { phone: app.user.phone } : {}),
            }
          : undefined,
      cafeId: app.cafeId,
      cafeName: app.cafe?.name,
      roomId: app.roomId ?? app.room?.id,
      roomName: app.room?.name,
      dateTime: app.dateTime,
      duration: app.duration,
      status: app.status,
      qrCode: app.qrCode,
      totalAmount: app.totalAmount
        ? typeof app.totalAmount === 'number' ||
          typeof app.totalAmount === 'string'
          ? String(app.totalAmount)
          : undefined
        : undefined,
      paymentMethod: app.paymentMethod,
      transactionId: app.transactionId,
      orderId,
      orderIds: orderIds.length ? orderIds : undefined,
      notes: app.notes,
      roomSnapshot:
        app.roomSnapshot && typeof app.roomSnapshot === 'object'
          ? (app.roomSnapshot as Record<string, unknown>)
          : undefined,
      selectedAssets:
        app.selectedAssets && typeof app.selectedAssets === 'object'
          ? (app.selectedAssets as Record<string, unknown>)
          : undefined,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }
}
