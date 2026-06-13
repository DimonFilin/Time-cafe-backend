import { GuestStatus, PrismaClient, WalletEntryType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { upsertKeycloakUsers } from '../../lib/keycloak-admin';
import { DEMO_PASS, MOBILE_USERS, STOCK } from './fixtures';
import type { ShowcaseCore } from './seed-showcase-core';

export type ShowcaseUsers = Record<
  string,
  { id: string; email: string; guestId: string }
>;

export async function seedShowcaseUsers(
  prisma: PrismaClient,
  core: ShowcaseCore,
): Promise<ShowcaseUsers> {
  console.log('\n👤 Mobile users (5) + review authors pool...');

  const kc = await upsertKeycloakUsers(
    MOBILE_USERS.map((u) => ({
      email: u.email,
      password: DEMO_PASS.user,
      firstName: u.firstName,
      lastName: u.lastName,
    })),
  );

  const users: ShowcaseUsers = {};
  const mainCafeId = core.cafes.nezavisimosti.id;
  const depositByTier = { bronze: 40, silver: 110, gold: 260 };

  for (const spec of MOBILE_USERS) {
    const user = await prisma.user.create({
      data: {
        keycloakId: kc[spec.email],
        email: spec.email,
        firstName: spec.firstName,
        lastName: spec.lastName,
        phone: spec.phone,
        avatar: STOCK.avatars[spec.avatarIdx],
        balance: 0,
        gender:
          spec.key === 'kate'
            ? 'FEMALE'
            : spec.key === 'ivan'
              ? 'MALE'
              : undefined,
      },
    });

    const tier = core.tiers[spec.tier];
    const guest = await prisma.networkGuest.create({
      data: {
        userId: user.id,
        registrationCafeId: mainCafeId,
        firstName: spec.firstName,
        lastName: spec.lastName,
        phone: spec.phone,
        email: spec.email,
        status: GuestStatus.ACTIVE,
        accessCardNumber: `SCUD-${spec.key.toUpperCase()}`,
        depositBalance: depositByTier[spec.tier],
        debt: spec.key === 'ivan' ? 8 : 0,
        loyaltyTierId: tier.id,
        phoneVerifiedAt: new Date(),
      },
    });

    await prisma.walletLedgerEntry.create({
      data: {
        guestId: guest.id,
        brandId: core.brands.timecafe.id,
        cafeId: mainCafeId,
        type: WalletEntryType.TOP_UP_CASH,
        amount: depositByTier[spec.tier],
        depositAfter: depositByTier[spec.tier],
        debtAfter: spec.key === 'ivan' ? 8 : 0,
        createdBy: 'seed-showcase',
      },
    });

    users[spec.key] = { id: user.id, email: spec.email, guestId: guest.id };
  }

  const reviewerCount = 120;
  const reviewerIds: string[] = [];
  const firstNames = [
    'Андрей',
    'Вера',
    'Глеб',
    'Дина',
    'Егор',
    'Жанна',
    'Зоя',
    'Илья',
    'Клара',
    'Леонид',
  ];
  const lastNames = [
    'Адамович',
    'Борисова',
    'Волков',
    'Гордеева',
    'Данилюк',
    'Ермак',
    'Жук',
    'Зайцева',
    'Иванюк',
    'Козлова',
  ];

  for (let i = 0; i < reviewerCount; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[(i * 3) % lastNames.length];
    const u = await prisma.user.create({
      data: {
        keycloakId: `seed-reviewer-${randomUUID()}`,
        email: `reviewer.${i}@internal.local`,
        firstName: fn,
        lastName: ln,
        phone: `+375-29-${String(6000000 + i).slice(-7)}`,
        avatar: STOCK.avatars[i % STOCK.avatars.length],
      },
    });
    reviewerIds.push(u.id);
  }

  return Object.assign(users, {
    _reviewerIds: reviewerIds,
  } as unknown as ShowcaseUsers);
}

export function getReviewerIds(users: ShowcaseUsers): string[] {
  return (users as unknown as { _reviewerIds: string[] })._reviewerIds ?? [];
}
