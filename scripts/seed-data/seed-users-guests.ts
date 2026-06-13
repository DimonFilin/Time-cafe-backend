import {
  GuestStatus,
  PendingBonusStatus,
  PrismaClient,
  WalletEntryType,
} from '@prisma/client';
import { ACCOUNTS, IMG, PASS } from './fixtures';
import { upsertKeycloakUsers } from '../lib/keycloak-admin';
import type { SeedContext } from './types';

export async function seedUsersGuests(
  prisma: PrismaClient,
  ctx: Pick<SeedContext, 'cafes' | 'tiers' | 'brands'>,
): Promise<Pick<SeedContext, 'users' | 'keycloakIds'>> {
  console.log('\n👤 Mobile users & network guests...');

  const kcUsers = ACCOUNTS.users.map((u) => ({
    email: u.email,
    password: PASS.user,
    firstName: u.firstName,
    lastName: u.lastName,
  }));
  const keycloakIds = await upsertKeycloakUsers(kcUsers);

  const depositByTier = { bronze: 45, silver: 120, gold: 280 };
  const users = {} as SeedContext['users'];

  for (const spec of ACCOUNTS.users) {
    const kcId = keycloakIds[spec.email];
    const user = await prisma.user.create({
      data: {
        keycloakId: kcId,
        email: spec.email,
        firstName: spec.firstName,
        lastName: spec.lastName,
        phone: spec.phone,
        avatar: `${IMG.avatar}${spec.key === 'acc1' ? 5 : spec.key === 'acc2' ? 12 : 32}`,
        balance: 0,
      },
    });
    users[spec.key] = user;

    const tier = ctx.tiers[spec.tier];
    const guest = await prisma.networkGuest.create({
      data: {
        userId: user.id,
        registrationCafeId: ctx.cafes.minskNezavisimosti.id,
        firstName: spec.firstName,
        lastName: spec.lastName,
        phone: spec.phone,
        email: spec.email,
        status: GuestStatus.ACTIVE,
        accessCardNumber: `BY-${spec.key.toUpperCase()}-001`,
        depositBalance: depositByTier[spec.tier],
        debt: spec.key === 'acc2' ? 5 : 0,
        loyaltyTierId: tier.id,
        phoneVerifiedAt: new Date(),
      },
    });

    await prisma.loyaltyTierHistory.create({
      data: {
        guestId: guest.id,
        toTierId: tier.id,
        reason: 'seed_initial',
        changedBy: 'seed',
      },
    });

    const ledger = await prisma.walletLedgerEntry.create({
      data: {
        guestId: guest.id,
        brandId: ctx.brands.timeCafeBy.id,
        cafeId: ctx.cafes.minskNezavisimosti.id,
        type: WalletEntryType.TOP_UP_CASH,
        amount: depositByTier[spec.tier],
        depositAfter: depositByTier[spec.tier],
        debtAfter: spec.key === 'acc2' ? 5 : 0,
        createdBy: 'seed',
      },
    });

    const scheduledAt = new Date();
    scheduledAt.setHours(scheduledAt.getHours() + 48);

    await prisma.pendingLoyaltyBonus.create({
      data: {
        guestId: guest.id,
        brandId: ctx.brands.timeCafeBy.id,
        cafeId: ctx.cafes.minskNezavisimosti.id,
        topUpLedgerId: ledger.id,
        topUpAmount: 30,
        bonusPercent: tier.bonusPercent,
        bonusAmount: Math.floor(30 * Number(tier.bonusPercent)) / 100,
        scheduledAt,
        status: PendingBonusStatus.SCHEDULED,
      },
    });

    if (spec.key === 'acc3') {
      const ledger2 = await prisma.walletLedgerEntry.create({
        data: {
          guestId: guest.id,
          type: WalletEntryType.LOYALTY_BONUS,
          amount: 15,
          depositAfter: depositByTier.gold + 15,
          debtAfter: 0,
          createdBy: 'seed',
        },
      });
      void ledger2;
    }

    await prisma.paymentCard.create({
      data: {
        userId: user.id,
        last4Digits:
          spec.key === 'acc1' ? '4242' : spec.key === 'acc2' ? '5555' : '1111',
        cardType: 'visa',
        expiryMonth: 12,
        expiryYear: 2028,
        isDefault: true,
        holderName: `${spec.firstName} ${spec.lastName}`.toUpperCase(),
      },
    });

    await prisma.userNotification.create({
      data: {
        userId: user.id,
        type: 'LOYALTY_WELCOME',
        title: 'Добро пожаловать',
        body: `Ваш уровень: ${tier.name}`,
      },
    });
  }

  const demoTier = ctx.tiers.bronze;
  await prisma.networkGuest.create({
    data: {
      registrationCafeId: ctx.cafes.minskNezavisimosti.id,
      firstName: 'Пётр',
      lastName: 'Черновиков',
      phone: '+375291000101',
      status: GuestStatus.DRAFT,
      loyaltyTierId: demoTier.id,
    },
  });
  await prisma.networkGuest.create({
    data: {
      registrationCafeId: ctx.cafes.minskNezavisimosti.id,
      firstName: 'Анна',
      lastName: 'Активная',
      phone: '+375291000102',
      status: GuestStatus.ACTIVE,
      accessCardNumber: 'DEMO-ACTIVE-002',
      phoneVerifiedAt: new Date(),
      loyaltyTierId: demoTier.id,
    },
  });
  await prisma.networkGuest.create({
    data: {
      registrationCafeId: ctx.cafes.minskNezavisimosti.id,
      firstName: 'Игорь',
      lastName: 'Отказной',
      phone: '+375291000103',
      status: GuestStatus.REFUSED,
      accessCardNumber: 'DEMO-REFUSED-003',
      phoneVerifiedAt: new Date(),
      refusedReason: 'Демо: отказ по заявлению',
      loyaltyTierId: demoTier.id,
    },
  });

  return { users, keycloakIds };
}
