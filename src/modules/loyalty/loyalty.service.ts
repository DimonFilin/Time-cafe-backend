import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkerRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import { UpdatePlatformLoyaltySettingsDto } from './dto/update-platform-settings.dto';
import {
  CreateLoyaltyTierDto,
  DeactivateLoyaltyTierDto,
  UpdateLoyaltyTierDto,
} from './dto/loyalty-tier.dto';
import { floorBonus, toNumber } from './loyalty-calculations';

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workersService: WorkersService,
  ) {}

  private async assertSystemAdmin(keycloakId: string) {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can manage loyalty');
    }
    return worker;
  }

  /** Session 2 TZ: staff may change guest loyalty tier manually. */
  private async assertStaffForGuestTier(keycloakId: string) {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) {
      throw new ForbiddenException('Требуется учётная запись сотрудника');
    }
    return worker;
  }

  async getPlatformSettings() {
    const row = await this.prisma.platformLoyaltySettings.findUnique({
      where: { id: 'singleton' },
    });
    if (row) return row;
    return this.prisma.platformLoyaltySettings.create({
      data: { id: 'singleton' },
    });
  }

  async updatePlatformSettings(
    keycloakId: string,
    dto: UpdatePlatformLoyaltySettingsDto,
  ) {
    await this.assertSystemAdmin(keycloakId);
    await this.getPlatformSettings();
    return this.prisma.platformLoyaltySettings.update({
      where: { id: 'singleton' },
      data: dto,
    });
  }

  async listTiers(includeInactive = false) {
    return this.prisma.loyaltyTier.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createTier(keycloakId: string, dto: CreateLoyaltyTierDto) {
    await this.assertSystemAdmin(keycloakId);
    const maxOrder = await this.prisma.loyaltyTier.aggregate({
      _max: { sortOrder: true },
    });
    return this.prisma.loyaltyTier.create({
      data: {
        name: dto.name,
        bonusPercent: dto.bonusPercent,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateTier(
    keycloakId: string,
    tierId: string,
    dto: UpdateLoyaltyTierDto,
  ) {
    await this.assertSystemAdmin(keycloakId);
    const tier = await this.prisma.loyaltyTier.findUnique({
      where: { id: tierId },
    });
    if (!tier) throw new NotFoundException('Tier not found');

    if (
      dto.bonusPercent !== undefined &&
      dto.bonusPercent !== Number(tier.bonusPercent)
    ) {
      const settings = await this.getPlatformSettings();
      if (tier.percentLockedUntil && tier.percentLockedUntil > new Date()) {
        throw new BadRequestException(
          'Bonus percent can be changed only once per cooldown period',
        );
      }
      const lockedUntil = new Date();
      lockedUntil.setHours(
        lockedUntil.getHours() + settings.tierPercentChangeCooldownHours,
      );
      return this.prisma.loyaltyTier.update({
        where: { id: tierId },
        data: {
          ...dto,
          bonusPercent: dto.bonusPercent,
          percentLockedUntil: lockedUntil,
        },
      });
    }

    return this.prisma.loyaltyTier.update({
      where: { id: tierId },
      data: dto,
    });
  }

  async reorderTiers(keycloakId: string, orderedIds: string[]) {
    await this.assertSystemAdmin(keycloakId);
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.loyaltyTier.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
    return this.listTiers(true);
  }

  async deactivateTier(
    keycloakId: string,
    tierId: string,
    dto: DeactivateLoyaltyTierDto,
  ) {
    await this.assertSystemAdmin(keycloakId);
    const tier = await this.prisma.loyaltyTier.findUnique({
      where: { id: tierId },
    });
    if (!tier) throw new NotFoundException('Tier not found');
    if (tier.isDefault) {
      throw new BadRequestException('Cannot deactivate default tier');
    }
    const target = await this.prisma.loyaltyTier.findUnique({
      where: { id: dto.migrateToTierId },
    });
    if (!target || !target.isActive) {
      throw new BadRequestException('Target tier must be active');
    }
    await this.prisma.$transaction([
      this.prisma.networkGuest.updateMany({
        where: { loyaltyTierId: tierId },
        data: { loyaltyTierId: dto.migrateToTierId },
      }),
      this.prisma.loyaltyTier.update({
        where: { id: tierId },
        data: { isActive: false },
      }),
    ]);
    return this.listTiers(true);
  }

  async getDefaultTier() {
    const tier = await this.prisma.loyaltyTier.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (!tier) {
      throw new NotFoundException('Default loyalty tier is not configured');
    }
    return tier;
  }

  async changeGuestTier(
    keycloakId: string,
    guestId: string,
    tierId: string,
    reason: string,
  ) {
    const worker = await this.assertStaffForGuestTier(keycloakId);
    const guest = await this.prisma.networkGuest.findUnique({
      where: { id: guestId },
    });
    if (!guest) throw new NotFoundException('Guest not found');
    const tier = await this.prisma.loyaltyTier.findUnique({
      where: { id: tierId },
    });
    if (!tier || !tier.isActive) {
      throw new BadRequestException('Target tier is not active');
    }
    await this.prisma.$transaction([
      this.prisma.networkGuest.update({
        where: { id: guestId },
        data: { loyaltyTierId: tierId },
      }),
      this.prisma.loyaltyTierHistory.create({
        data: {
          guestId,
          fromTierId: guest.loyaltyTierId,
          toTierId: tierId,
          reason,
          changedBy: worker.id,
        },
      }),
    ]);
    return this.prisma.networkGuest.findUnique({
      where: { id: guestId },
      include: { loyaltyTier: true },
    });
  }

  async getGuestTierHistory(guestId: string) {
    const rows = await this.prisma.loyaltyTierHistory.findMany({
      where: { guestId },
      orderBy: { createdAt: 'desc' },
      include: { fromTier: true, toTier: true },
    });
    const workerIds = [
      ...new Set(rows.map((r) => r.changedBy).filter((id) => id !== 'system')),
    ];
    const workers = await this.prisma.workerAccount.findMany({
      where: { id: { in: workerIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const byId = new Map(workers.map((w) => [w.id, w]));
    return rows.map((row) => {
      if (row.changedBy === 'system') {
        return { ...row, changedByName: 'Система' };
      }
      const w = byId.get(row.changedBy);
      return {
        ...row,
        changedByName: w
          ? [w.lastName, w.firstName].filter(Boolean).join(' ').trim() ||
            row.changedBy
          : row.changedBy,
      };
    });
  }

  /** Exposed for wallet preview */
  calcBonusAmount(topUpAmount: number, bonusPercent: number | Prisma.Decimal) {
    return floorBonus(topUpAmount, toNumber(bonusPercent));
  }
}
