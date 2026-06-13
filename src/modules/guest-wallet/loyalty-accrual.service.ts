import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PendingBonusStatus, WalletEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toNumber } from '../loyalty/loyalty-calculations';

@Injectable()
export class LoyaltyAccrualService {
  private readonly logger = new Logger(LoyaltyAccrualService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('*/15 * * * *')
  async accruePendingBonuses(): Promise<void> {
    const now = new Date();
    const pending = await this.prisma.pendingLoyaltyBonus.findMany({
      where: {
        status: PendingBonusStatus.SCHEDULED,
        scheduledAt: { lte: now },
      },
      take: 100,
      include: { guest: { include: { user: true } } },
    });

    for (const item of pending) {
      try {
        await this.accrueOne(item.id);
      } catch (err) {
        this.logger.error(`Failed to accrue bonus ${item.id}`, err);
      }
    }
  }

  async accrueOne(pendingId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const pending = await tx.pendingLoyaltyBonus.findUnique({
        where: { id: pendingId },
        include: { guest: { include: { user: true } } },
      });
      if (!pending || pending.status !== PendingBonusStatus.SCHEDULED) {
        return;
      }

      const guest = pending.guest;
      const bonus = toNumber(pending.bonusAmount);
      const deposit = toNumber(guest.depositBalance) + bonus;

      await tx.networkGuest.update({
        where: { id: guest.id },
        data: { depositBalance: deposit },
      });

      const ledger = await tx.walletLedgerEntry.create({
        data: {
          guestId: guest.id,
          brandId: pending.brandId,
          cafeId: pending.cafeId,
          type: WalletEntryType.LOYALTY_BONUS,
          amount: bonus,
          depositAfter: deposit,
          debtAfter: toNumber(guest.debt),
          referenceId: pending.id,
        },
      });

      await tx.pendingLoyaltyBonus.update({
        where: { id: pending.id },
        data: {
          status: PendingBonusStatus.CREDITED,
          creditedAt: new Date(),
        },
      });

      if (guest.userId) {
        await tx.userNotification.create({
          data: {
            userId: guest.userId,
            type: 'LOYALTY_BONUS',
            title: 'Бонус лояльности',
            body: `На ваш депозит зачислено ${bonus} BYN бонусом лояльности.`,
            meta: {
              guestId: guest.id,
              bonusAmount: bonus,
              ledgerId: ledger.id,
              pendingId: pending.id,
            },
          },
        });
      }
    });
  }
}
