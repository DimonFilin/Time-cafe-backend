import { PrismaClient } from '@prisma/client';

export async function seedLoyalty(prisma: PrismaClient): Promise<void> {
  await prisma.platformLoyaltySettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      enabled: false,
      accrualDelayHours: 120,
      minTopUpForBonus: 20,
      tierPercentChangeCooldownHours: 24,
      timezone: 'Europe/Moscow',
    },
    update: {},
  });

  const tiers = [
    { name: 'Бронзовый', bonusPercent: 5, sortOrder: 1, isDefault: true },
    { name: 'Серебряный', bonusPercent: 8, sortOrder: 2, isDefault: false },
    { name: 'Золотой', bonusPercent: 13, sortOrder: 3, isDefault: false },
  ];

  for (const tier of tiers) {
    const existing = await prisma.loyaltyTier.findFirst({
      where: { name: tier.name },
    });
    if (existing) {
      await prisma.loyaltyTier.update({
        where: { id: existing.id },
        data: {
          bonusPercent: tier.bonusPercent,
          sortOrder: tier.sortOrder,
          isDefault: tier.isDefault,
          isActive: true,
        },
      });
    } else {
      await prisma.loyaltyTier.create({ data: tier });
    }
  }

  console.log('✓ Loyalty platform settings and tiers seeded');
}
