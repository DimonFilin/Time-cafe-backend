import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  PendingBonusStatus,
  WalletEntryType,
  WorkerRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import { toNumber } from '../loyalty/loyalty-calculations';

const CASH_INFLOW_TYPES: WalletEntryType[] = [
  WalletEntryType.TOP_UP_CASH,
  WalletEntryType.TOP_UP_CARD,
  WalletEntryType.TOP_UP_MOBILE,
];

@Injectable()
export class LoyaltyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workersService: WorkersService,
  ) {}

  private async assertReportAccess(keycloakId: string, brandId?: string) {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) throw new ForbiddenException('Unauthorized');
    if (worker.role === WorkerRole.SYSTEM_ADMIN) {
      return { worker, brandId: brandId ?? undefined };
    }
    if (worker.role === WorkerRole.BRAND_ADMIN && worker.brandId) {
      return { worker, brandId: worker.brandId };
    }
    throw new ForbiddenException('Insufficient permissions for reports');
  }

  async balances(keycloakId: string) {
    await this.assertReportAccess(keycloakId);
    const guests = await this.prisma.networkGuest.findMany({
      include: { loyaltyTier: true },
      orderBy: { lastName: 'asc' },
    });
    return guests.map((g) => ({
      guestId: g.id,
      name: [g.lastName, g.firstName].filter(Boolean).join(' '),
      phone: g.phone,
      depositBalance: toNumber(g.depositBalance),
      debt: toNumber(g.debt),
      tierName: g.loyaltyTier?.name ?? null,
    }));
  }

  async balancesWithBonuses(keycloakId: string, includeDetail = false) {
    await this.assertReportAccess(keycloakId);
    const guests = await this.prisma.networkGuest.findMany({
      include: {
        loyaltyTier: true,
        pendingBonuses: {
          where: { status: PendingBonusStatus.SCHEDULED },
        },
      },
    });
    return guests.map((g) => {
      const pending = g.pendingBonuses;
      const pendingTotal = pending.reduce(
        (s, p) => s + toNumber(p.bonusAmount),
        0,
      );
      return {
        guestId: g.id,
        name: [g.lastName, g.firstName].filter(Boolean).join(' '),
        phone: g.phone,
        depositBalance: toNumber(g.depositBalance),
        pendingBonusTotal: pendingTotal,
        balanceWithBonuses: toNumber(g.depositBalance) + pendingTotal,
        debt: toNumber(g.debt),
        tierName: g.loyaltyTier?.name ?? null,
        pendingDetails: includeDetail
          ? pending.map((p) => ({
              id: p.id,
              bonusAmount: toNumber(p.bonusAmount),
              scheduledAt: p.scheduledAt,
              topUpAmount: toNumber(p.topUpAmount),
            }))
          : undefined,
      };
    });
  }

  async debtors(keycloakId: string) {
    await this.assertReportAccess(keycloakId);
    const guests = await this.prisma.networkGuest.findMany({
      where: { debt: { gt: 0 } },
      orderBy: { debt: 'desc' },
    });
    return guests.map((g) => ({
      guestId: g.id,
      name: [g.lastName, g.firstName].filter(Boolean).join(' '),
      phone: g.phone,
      debt: toNumber(g.debt),
    }));
  }

  async cashInflows(
    keycloakId: string,
    from: Date,
    to: Date,
    brandId?: string,
  ) {
    const { brandId: scopedBrand } = await this.assertReportAccess(
      keycloakId,
      brandId,
    );
    const entries = await this.prisma.walletLedgerEntry.findMany({
      where: {
        type: { in: CASH_INFLOW_TYPES },
        createdAt: { gte: from, lte: to },
        ...(scopedBrand ? { brandId: scopedBrand } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });
    const total = entries.reduce((s, e) => s + toNumber(e.amount), 0);
    return { total, entries };
  }
}
