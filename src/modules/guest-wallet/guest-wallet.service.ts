import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PendingBonusStatus,
  WalletEntryType,
  WorkerRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  computeBonusPreview,
  resolveWillAccrue,
  scheduledAccrualAt,
  toNumber,
  TopUpSource,
} from '../loyalty/loyalty-calculations';
import {
  parseBrandLoyaltySettings,
  LoyaltyDisplayMode,
} from '../loyalty/brand-loyalty-settings';
import { buildTopUpNotification } from '../../common/guest/wallet-notification.lib';
import { walletLedgerTypeLabel } from '../../common/guest/wallet-ledger.lib';
import { TopUpDto } from './dto/top-up.dto';

const TOP_UP_TYPES: WalletEntryType[] = [
  WalletEntryType.TOP_UP_CASH,
  WalletEntryType.TOP_UP_CARD,
  WalletEntryType.TOP_UP_MOBILE,
];

@Injectable()
export class GuestWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workersService: WorkersService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  private async resolveBrandContext(cafeId?: string) {
    if (!cafeId) {
      return { brandId: null as string | null, brandBonusesEnabled: true };
    }
    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
      include: { brand: true },
    });
    if (!cafe) throw new NotFoundException('Cafe not found');
    const loyalty = parseBrandLoyaltySettings(cafe.brand.settings);
    return {
      brandId: cafe.brandId,
      brandBonusesEnabled: loyalty.bonusesEnabled,
      displayMode: loyalty.displayMode,
    };
  }

  async buildPreview(guestId: string, dto: TopUpDto, source: TopUpSource) {
    const guest = await this.prisma.networkGuest.findUnique({
      where: { id: guestId },
      include: { loyaltyTier: true },
    });
    if (!guest) throw new NotFoundException('Guest not found');
    if (!guest.loyaltyTier) {
      throw new BadRequestException('Guest has no loyalty tier');
    }

    const platform = await this.loyaltyService.getPlatformSettings();
    const brandCtx = await this.resolveBrandContext(dto.cafeId);
    const amount = dto.amount;
    const debt = toNumber(guest.debt);
    const toDebt = Math.min(amount, debt);
    const toDeposit = amount - toDebt;
    const bonusBase = toDeposit;

    const { willAccrue, reasonIfNot } = resolveWillAccrue({
      platformEnabled: platform.enabled,
      minTopUpForBonus: toNumber(platform.minTopUpForBonus),
      topUpAmount: bonusBase,
      source,
      brandBonusesEnabled: brandCtx.brandBonusesEnabled,
    });

    const percent = toNumber(guest.loyaltyTier.bonusPercent);
    const { bonusAmount } = computeBonusPreview({
      topUpAmount: bonusBase,
      bonusPercent: percent,
    });
    const scheduledAt = scheduledAccrualAt(
      new Date(),
      platform.accrualDelayHours,
    );

    return {
      guestId,
      amount,
      toDebt,
      toDeposit,
      depositAfter: toNumber(guest.depositBalance) + toDeposit,
      debtAfter: Math.max(0, debt - toDebt),
      tierName: guest.loyaltyTier.name,
      bonusPercent: percent,
      hypotheticBonus: bonusAmount,
      scheduledAt,
      willAccrue,
      reasonIfNot,
      displayMode: brandCtx.displayMode ?? ('BRIEF' as LoyaltyDisplayMode),
    };
  }

  async getGuestPaymentCards(guestId: string) {
    const guest = await this.prisma.networkGuest.findUnique({
      where: { id: guestId },
      select: { userId: true },
    });
    if (!guest?.userId) return [];
    return this.prisma.paymentCard.findMany({
      where: { userId: guest.userId, isActive: true },
      select: {
        id: true,
        last4Digits: true,
        cardType: true,
        isDefault: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async resolvePaymentCard(guestId: string, paymentCardId?: string) {
    if (!paymentCardId) return null;
    const guest = await this.prisma.networkGuest.findUnique({
      where: { id: guestId },
      select: { userId: true },
    });
    if (!guest?.userId) {
      throw new BadRequestException(
        'У клиента нет аккаунта в приложении — оплата картой недоступна',
      );
    }
    const card = await this.prisma.paymentCard.findFirst({
      where: { id: paymentCardId, userId: guest.userId, isActive: true },
    });
    if (!card) {
      throw new BadRequestException('Карта клиента не найдена');
    }
    return card;
  }

  async topUp(
    keycloakId: string | null,
    guestId: string,
    dto: TopUpDto,
    source: TopUpSource,
    opts?: { userId?: string },
  ) {
    if (keycloakId) {
      const worker = await this.workersService.findByKeycloakId(keycloakId);
      if (!worker) throw new ForbiddenException('Unauthorized');
    } else if (!opts?.userId) {
      throw new ForbiddenException('Unauthorized');
    }

    if (dto.paymentType === WalletEntryType.TOP_UP_CARD && !dto.paymentCardId) {
      throw new BadRequestException('Выберите карту для оплаты');
    }

    const paymentCard = await this.resolvePaymentCard(
      guestId,
      dto.paymentCardId,
    );

    const preview = await this.buildPreview(guestId, dto, source);
    const guest = await this.prisma.networkGuest.findUnique({
      where: { id: guestId },
      include: { loyaltyTier: true },
    });
    if (!guest || !guest.loyaltyTier) {
      throw new NotFoundException('Guest not found');
    }

    const brandCtx = await this.resolveBrandContext(dto.cafeId);
    const worker = keycloakId
      ? await this.workersService.findByKeycloakId(keycloakId)
      : null;

    const notifyUserId = guest.userId ?? opts?.userId ?? null;

    return this.prisma.$transaction(async (tx) => {
      let deposit = toNumber(guest.depositBalance);
      let debt = toNumber(guest.debt);
      const toDebt = preview.toDebt;
      const toDeposit = preview.toDeposit;
      debt = Math.max(0, debt - toDebt);
      deposit += toDeposit;

      const ledger = await tx.walletLedgerEntry.create({
        data: {
          guestId,
          brandId: brandCtx.brandId,
          cafeId: dto.cafeId ?? null,
          type: dto.paymentType as WalletEntryType,
          amount: dto.amount,
          depositAfter: deposit,
          debtAfter: debt,
          createdBy: worker?.id ?? opts?.userId ?? null,
          meta: {
            toDebt,
            toDeposit,
            source,
            paymentCardId: paymentCard?.id ?? null,
            cardLast4: paymentCard?.last4Digits ?? null,
          },
        },
      });

      if (toDebt > 0) {
        await tx.walletLedgerEntry.create({
          data: {
            guestId,
            brandId: brandCtx.brandId,
            cafeId: dto.cafeId ?? null,
            type: WalletEntryType.DEBT_REPAYMENT,
            amount: toDebt,
            depositAfter: deposit,
            debtAfter: debt,
            createdBy: worker?.id ?? opts?.userId ?? null,
            referenceId: ledger.id,
          },
        });
      }

      await tx.networkGuest.update({
        where: { id: guestId },
        data: { depositBalance: deposit, debt },
      });

      let pending: Awaited<
        ReturnType<typeof tx.pendingLoyaltyBonus.create>
      > | null = null;
      if (preview.willAccrue && preview.hypotheticBonus > 0) {
        pending = await tx.pendingLoyaltyBonus.create({
          data: {
            guestId,
            brandId: brandCtx.brandId,
            cafeId: dto.cafeId ?? null,
            topUpLedgerId: ledger.id,
            topUpAmount: toDeposit,
            bonusPercent: preview.bonusPercent,
            bonusAmount: preview.hypotheticBonus,
            scheduledAt: preview.scheduledAt,
            status: PendingBonusStatus.SCHEDULED,
          },
        });
      }

      if (notifyUserId) {
        const n = buildTopUpNotification({
          amount: dto.amount,
          paymentType: dto.paymentType,
          source,
          cardLabel: paymentCard?.last4Digits ?? null,
        });
        await tx.userNotification.create({
          data: {
            userId: notifyUserId,
            type: n.type,
            title: n.title,
            body: n.body,
            meta: {
              amount: dto.amount,
              paymentType: dto.paymentType,
              ledgerId: ledger.id,
              source,
              cardLast4: paymentCard?.last4Digits ?? null,
            },
          },
        });
      }

      return {
        ledger,
        pending,
        wallet: {
          depositBalance: deposit,
          debt,
        },
        preview,
        success: true,
        message: `Депозит пополнен на ${dto.amount.toFixed(2)} BYN`,
      };
    });
  }

  async getWallet(guestId: string) {
    const guest = await this.prisma.networkGuest.findUnique({
      where: { id: guestId },
      include: {
        loyaltyTier: true,
        pendingBonuses: {
          where: { status: PendingBonusStatus.SCHEDULED },
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });
    if (!guest) throw new NotFoundException('Guest not found');
    const pendingSum = guest.pendingBonuses.reduce(
      (s, p) => s + toNumber(p.bonusAmount),
      0,
    );
    return {
      depositBalance: toNumber(guest.depositBalance),
      debt: toNumber(guest.debt),
      pendingBonusTotal: pendingSum,
      pendingBonuses: guest.pendingBonuses,
      loyaltyTier: guest.loyaltyTier,
      loyaltyWelcomeShownAt: guest.loyaltyWelcomeShownAt,
      phoneVerifiedAt: guest.phoneVerifiedAt,
      accessCardNumber: guest.accessCardNumber,
      loyaltyWelcomeEligible:
        !!guest.phoneVerifiedAt &&
        !!guest.accessCardNumber &&
        !guest.loyaltyWelcomeShownAt,
    };
  }

  async getLedger(guestId: string, take = 50, skip = 0) {
    const items = await this.prisma.walletLedgerEntry.findMany({
      where: { guestId },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
    const total = await this.prisma.walletLedgerEntry.count({
      where: { guestId },
    });
    return {
      items: items.map((e) => ({
        ...e,
        amount: toNumber(e.amount),
        depositAfter: toNumber(e.depositAfter),
        debtAfter: toNumber(e.debtAfter),
        label: walletLedgerTypeLabel(e.type),
      })),
      total,
    };
  }

  async refundTopUp(keycloakId: string, ledgerId: string) {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('SYSTEM_ADMIN required');
    }
    const ledger = await this.prisma.walletLedgerEntry.findUnique({
      where: { id: ledgerId },
      include: { pendingBonus: true, guest: true },
    });
    if (!ledger || !TOP_UP_TYPES.includes(ledger.type)) {
      throw new BadRequestException('Not a top-up ledger entry');
    }
    const pending = ledger.pendingBonus;
    if (pending?.status === PendingBonusStatus.CREDITED) {
      throw new BadRequestException('Bonus already credited');
    }

    return this.prisma.$transaction(async (tx) => {
      if (pending) {
        await tx.pendingLoyaltyBonus.update({
          where: { id: pending.id },
          data: {
            status: PendingBonusStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        });
      }
      const guest = ledger.guest;
      let deposit = toNumber(guest.depositBalance);
      let debt = toNumber(guest.debt);
      const meta = ledger.meta as {
        toDebt?: number;
        toDeposit?: number;
      } | null;
      const toDeposit = meta?.toDeposit ?? toNumber(ledger.amount);
      const toDebt = meta?.toDebt ?? 0;
      deposit = Math.max(0, deposit - toDeposit);
      debt += toDebt;

      await tx.networkGuest.update({
        where: { id: guest.id },
        data: { depositBalance: deposit, debt },
      });

      return tx.walletLedgerEntry.create({
        data: {
          guestId: guest.id,
          brandId: ledger.brandId,
          cafeId: ledger.cafeId,
          type: WalletEntryType.REFUND,
          amount: toNumber(ledger.amount),
          depositAfter: deposit,
          debtAfter: debt,
          referenceId: ledger.id,
          createdBy: worker.id,
        },
      });
    });
  }
}
