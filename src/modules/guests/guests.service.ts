import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuestStatus, Prisma } from '@prisma/client';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import { PushNotificationService } from '../../common/notifications/push-notification.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { formatGuestDisplayName } from '../../common/guest/guest-display.lib';
import {
  guestPhoneValidationMessage,
  normalizeGuestPhone,
  phoneDigitsOnly,
} from '../../common/guest/guest-phone.lib';
import { resolveLoyaltyTierKey } from '../../common/guest/loyalty-tier-key.lib';
import {
  buildScudQrPayload,
  parseScudQrPayload,
} from '../../common/guest/scud-qr.lib';
import { CreateNetworkGuestDto, UpdateNetworkGuestDto } from './dto/guest.dto';

const PHONE_VERIFY_TTL_MS = 10 * 60 * 1000;
const guestInclude = {
  loyaltyTier: true,
  registrationCafe: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
} satisfies Prisma.NetworkGuestInclude;

type GuestRecord = Prisma.NetworkGuestGetPayload<{
  include: typeof guestInclude;
}>;

@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workersService: WorkersService,
    private readonly loyaltyService: LoyaltyService,
    private readonly pushService: PushNotificationService,
  ) {}

  private async assertStaff(keycloakId: string) {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) {
      throw new ForbiddenException('Требуется учётная запись сотрудника');
    }
    return worker;
  }

  mapGuestPublic(guest: GuestRecord) {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const {
      phoneVerifyCodeHash: _h,
      phoneVerifyExpiresAt: _e,
      ...rest
    } = guest;
    /* eslint-enable @typescript-eslint/no-unused-vars */
    return {
      ...rest,
      displayName: formatGuestDisplayName(guest),
      phoneVerified: !!guest.phoneVerifiedAt,
    };
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  /** Bronze default tier + welcome modal after phone verify and SCUD card (session 2 TZ). */
  async applyLoyaltyActivationAfterScud(guestId: string) {
    const guest = await this.prisma.networkGuest.findUnique({
      where: { id: guestId },
    });
    if (!guest?.phoneVerifiedAt || !guest.accessCardNumber) return;

    const defaultTier = await this.loyaltyService.getDefaultTier();
    const tierId = guest.loyaltyTierId ?? defaultTier.id;
    const showWelcome = !guest.loyaltyWelcomeShownAt;

    await this.prisma.$transaction(async (tx) => {
      await tx.networkGuest.update({
        where: { id: guestId },
        data: {
          loyaltyTierId: tierId,
          ...(showWelcome ? { loyaltyWelcomeShownAt: null } : {}),
          status:
            guest.status !== GuestStatus.REFUSED
              ? GuestStatus.ACTIVE
              : guest.status,
        },
      });
      const hasActivationHistory = await tx.loyaltyTierHistory.findFirst({
        where: { guestId, reason: 'Регистрация и карта СКУД' },
      });
      if (!hasActivationHistory) {
        await tx.loyaltyTierHistory.create({
          data: {
            guestId,
            fromTierId: guest.loyaltyTierId,
            toTierId: tierId,
            reason: 'Регистрация и карта СКУД',
            changedBy: 'system',
          },
        });
      }
    });

    if (showWelcome && guest.userId) {
      await this.pushService.sendToUser(guest.userId, {
        title: 'TimeCafe',
        body: `Поздравляем! Вам назначен уровень «${defaultTier.name}».`,
        channelId: 'loyalty',
        data: { type: 'LOYALTY_WELCOME' },
      });
    }
  }

  async create(keycloakId: string, dto: CreateNetworkGuestDto) {
    await this.assertStaff(keycloakId);
    const phone = normalizeGuestPhone(dto.phone);
    if (!phone) {
      throw new BadRequestException(guestPhoneValidationMessage());
    }
    const existing = await this.prisma.networkGuest.findUnique({
      where: { phone },
    });
    if (existing) {
      throw new ConflictException(
        'Клиент с таким телефоном уже зарегистрирован',
      );
    }
    const defaultTier = await this.loyaltyService.getDefaultTier();
    const guest = await this.prisma.networkGuest.create({
      data: {
        registrationCafeId: dto.registrationCafeId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        patronymic: dto.patronymic,
        phone,
        email: dto.email,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender,
        notes: dto.notes,
        loyaltyTierId: defaultTier.id,
        status: GuestStatus.DRAFT,
      },
      include: guestInclude,
    });
    return this.mapGuestPublic(guest);
  }

  async findAll(keycloakId: string, params?: { status?: GuestStatus }) {
    await this.assertStaff(keycloakId);
    const guests = await this.prisma.networkGuest.findMany({
      where: params?.status ? { status: params.status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: guestInclude,
    });
    return guests.map((g) => this.mapGuestPublic(g));
  }

  async findOne(keycloakId: string, id: string) {
    await this.assertStaff(keycloakId);
    const guest = await this.prisma.networkGuest.findUnique({
      where: { id },
      include: guestInclude,
    });
    if (!guest) throw new NotFoundException('Клиент не найден');
    return this.mapGuestPublic(guest);
  }

  async lookupByCardOrPhone(
    accessCardNumber?: string,
    phone?: string,
  ): Promise<GuestRecord> {
    if (!phone?.trim() && !accessCardNumber?.trim()) {
      throw new BadRequestException('Укажите телефон или номер карты СКУД');
    }

    if (accessCardNumber?.trim()) {
      const byCard = await this.prisma.networkGuest.findFirst({
        where: { accessCardNumber: accessCardNumber.trim() },
        include: guestInclude,
      });
      if (byCard) return byCard;
    }

    if (phone?.trim()) {
      const normalized = normalizeGuestPhone(phone);
      if (!normalized) {
        throw new BadRequestException(guestPhoneValidationMessage());
      }
      const digits = phoneDigitsOnly(normalized);
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM network_guests
        WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ${digits}
        LIMIT 1
      `;
      if (rows[0]?.id) {
        const guest = await this.prisma.networkGuest.findUnique({
          where: { id: rows[0].id },
          include: guestInclude,
        });
        if (guest) return guest;
      }
    }

    throw new NotFoundException('Клиент не найден');
  }

  async lookup(
    keycloakId: string,
    phone?: string,
    accessCardNumber?: string,
    payload?: string,
  ) {
    await this.assertStaff(keycloakId);
    let card = accessCardNumber?.trim();
    if (!card && payload) {
      card = parseScudQrPayload(payload) ?? undefined;
    }
    const guest = await this.lookupByCardOrPhone(card, phone?.trim());
    return this.mapGuestPublic(guest);
  }

  async update(keycloakId: string, id: string, dto: UpdateNetworkGuestDto) {
    await this.assertStaff(keycloakId);
    const guest = await this.prisma.networkGuest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundException('Клиент не найден');

    const data: Prisma.NetworkGuestUpdateInput = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      patronymic: dto.patronymic,
      email: dto.email,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      gender: dto.gender,
      refusedReason: dto.refusedReason,
      notes: dto.notes,
    };

    if (dto.phone && dto.phone !== guest.phone) {
      const normalized = normalizeGuestPhone(dto.phone);
      if (!normalized) {
        throw new BadRequestException(guestPhoneValidationMessage());
      }
      const dup = await this.prisma.networkGuest.findUnique({
        where: { phone: normalized },
      });
      if (dup && dup.id !== id) {
        throw new ConflictException(
          'Клиент с таким телефоном уже зарегистрирован',
        );
      }
      data.phone = normalized;
      data.phoneVerifiedAt = null;
      data.phoneVerifyCodeHash = null;
      data.phoneVerifyExpiresAt = null;
      if (guest.status === GuestStatus.ACTIVE && !dto.status) {
        data.status = GuestStatus.DRAFT;
      }
    }

    if (dto.accessCardNumber) {
      if (!guest.phoneVerifiedAt) {
        throw new BadRequestException(
          'Сначала подтвердите телефон клиента, затем выдайте карту СКУД',
        );
      }
      const dup = await this.prisma.networkGuest.findFirst({
        where: { accessCardNumber: dto.accessCardNumber, NOT: { id } },
      });
      if (dup) {
        throw new ConflictException('Эта карта СКУД уже используется');
      }
      data.accessCardNumber = dto.accessCardNumber;
    }

    let status = dto.status;
    const phoneOk = dto.phone
      ? data.phoneVerifiedAt !== null
      : !!guest.phoneVerifiedAt;
    if (dto.accessCardNumber && phoneOk) {
      status = status ?? GuestStatus.ACTIVE;
    }
    if (status) data.status = status;

    const updated = await this.prisma.networkGuest.update({
      where: { id },
      data,
      include: guestInclude,
    });
    if (
      dto.accessCardNumber &&
      (data.phoneVerifiedAt ?? guest.phoneVerifiedAt)
    ) {
      await this.applyLoyaltyActivationAfterScud(id);
      const fresh = await this.prisma.networkGuest.findUnique({
        where: { id },
        include: guestInclude,
      });
      return this.mapGuestPublic((fresh ?? updated) as GuestRecord);
    }
    return this.mapGuestPublic(updated);
  }

  async requestPhoneVerify(keycloakId: string, id: string) {
    await this.assertStaff(keycloakId);
    const guest = await this.prisma.networkGuest.findUnique({
      where: { id },
      include: guestInclude,
    });
    if (!guest) throw new NotFoundException('Клиент не найден');

    const code = String(randomInt(10000, 99999));
    const expiresAt = new Date(Date.now() + PHONE_VERIFY_TTL_MS);

    await this.prisma.networkGuest.update({
      where: { id },
      data: {
        phoneVerifyCodeHash: this.hashCode(code),
        phoneVerifyExpiresAt: expiresAt,
      },
    });

    let pushSent = false;
    if (guest.userId) {
      pushSent = await this.pushService.sendToUser(guest.userId, {
        title: 'TimeCafe — код подтверждения',
        body: `Код: ${code}. Действует 10 мин.`,
        channelId: 'phone_verify',
        data: { type: 'PHONE_VERIFY', guestId: id },
        priority: 'high',
      });
    }

    return { code, expiresAt, pushSent, inAppSent: false };
  }

  async confirmPhoneVerify(keycloakId: string, id: string, code: string) {
    await this.assertStaff(keycloakId);
    const guest = await this.prisma.networkGuest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundException('Клиент не найден');

    if (!guest.phoneVerifyCodeHash || !guest.phoneVerifyExpiresAt) {
      throw new BadRequestException('Сначала запросите код подтверждения');
    }
    if (guest.phoneVerifyExpiresAt < new Date()) {
      throw new BadRequestException(
        'Срок действия кода истёк. Запросите новый код',
      );
    }
    if (this.hashCode(code.trim()) !== guest.phoneVerifyCodeHash) {
      throw new BadRequestException('Неверный код подтверждения');
    }

    const updated = (await this.prisma.networkGuest.update({
      where: { id },
      data: {
        phoneVerifiedAt: new Date(),
        phoneVerifyCodeHash: null,
        phoneVerifyExpiresAt: null,
        status:
          guest.accessCardNumber && guest.status !== GuestStatus.REFUSED
            ? GuestStatus.ACTIVE
            : guest.status,
      },
      include: guestInclude,
    })) as GuestRecord;
    await this.applyLoyaltyActivationAfterScud(id);
    const fresh = await this.prisma.networkGuest.findUnique({
      where: { id },
      include: guestInclude,
    });
    return this.mapGuestPublic(fresh ?? updated);
  }

  async refuseGuest(keycloakId: string, id: string, refusedReason: string) {
    await this.assertStaff(keycloakId);
    const guest = await this.prisma.networkGuest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundException('Клиент не найден');
    if (guest.status !== GuestStatus.ACTIVE) {
      throw new BadRequestException(
        'Отказ доступен только для активных клиентов',
      );
    }

    const updated = await this.prisma.networkGuest.update({
      where: { id },
      data: {
        status: GuestStatus.REFUSED,
        refusedReason: refusedReason.trim(),
      },
      include: guestInclude,
    });
    return this.mapGuestPublic(updated);
  }

  async restoreGuest(keycloakId: string, id: string) {
    await this.assertStaff(keycloakId);
    const guest = await this.prisma.networkGuest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundException('Клиент не найден');
    if (guest.status !== GuestStatus.REFUSED) {
      throw new BadRequestException(
        'Восстановление доступно только после отказа',
      );
    }

    const nextStatus =
      guest.phoneVerifiedAt && guest.accessCardNumber
        ? GuestStatus.ACTIVE
        : GuestStatus.DRAFT;

    const updated = await this.prisma.networkGuest.update({
      where: { id },
      data: { status: nextStatus, refusedReason: null },
      include: guestInclude,
    });
    return this.mapGuestPublic(updated);
  }

  async linkUserByPhone(userId: string, phone: string) {
    if (!phone) return null;
    const guest = await this.prisma.networkGuest.findUnique({
      where: { phone },
    });
    if (!guest) return null;
    if (guest.userId && guest.userId !== userId) {
      return guest;
    }
    return this.prisma.networkGuest.update({
      where: { id: guest.id },
      data: { userId },
      include: { loyaltyTier: true },
    });
  }

  async markWelcomeShown(guestId: string) {
    return this.prisma.networkGuest.update({
      where: { id: guestId },
      data: { loyaltyWelcomeShownAt: new Date() },
    });
  }

  async getByUserId(userId: string) {
    return this.prisma.networkGuest.findUnique({
      where: { userId },
      include: {
        loyaltyTier: true,
        pendingBonuses: {
          where: { status: 'SCHEDULED' },
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });
  }

  async ensureGuestForUser(user: {
    id: string;
    phone?: string | null;
    firstName: string;
    lastName: string;
    email: string;
  }) {
    const linked = await this.getByUserId(user.id);
    if (linked) return linked;
    if (user.phone) {
      const byPhone = await this.linkUserByPhone(user.id, user.phone);
      if (byPhone) return byPhone;
    }
    const defaultTier = await this.loyaltyService.getDefaultTier();
    return this.prisma.networkGuest.create({
      data: {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? `user-${user.id}`,
        email: user.email,
        loyaltyTierId: defaultTier.id,
        status: GuestStatus.ACTIVE,
        phoneVerifiedAt: new Date(),
      },
      include: { loyaltyTier: true },
    });
  }

  async getScudCardForUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    const linked = await this.ensureGuestForUser({
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    });
    const guest = await this.prisma.networkGuest.findUniqueOrThrow({
      where: { id: linked.id },
      include: { loyaltyTier: true },
    });

    const tierKey = resolveLoyaltyTierKey(guest.loyaltyTier?.name);

    const canShowQr =
      guest.status === GuestStatus.ACTIVE &&
      !!guest.accessCardNumber &&
      !!guest.phoneVerifiedAt;

    return {
      guestId: guest.id,
      status: guest.status,
      accessCardNumber: guest.accessCardNumber,
      phone: guest.phone,
      firstName: guest.firstName,
      lastName: guest.lastName,
      patronymic: guest.patronymic,
      displayName: formatGuestDisplayName(guest),
      phoneVerified: !!guest.phoneVerifiedAt,
      canShowQr,
      qrPayload:
        canShowQr && guest.accessCardNumber
          ? buildScudQrPayload(guest.accessCardNumber)
          : null,
      loyaltyTier: guest.loyaltyTier
        ? {
            key: tierKey,
            name: guest.loyaltyTier.name,
            bonusPercent: Number(guest.loyaltyTier.bonusPercent),
          }
        : null,
      depositBalance: Number(guest.depositBalance),
      debt: Number(guest.debt),
    };
  }
}
