import { BrandStatus, PrismaClient } from '@prisma/client';
import { IMG, OPENING_HOURS } from './fixtures';
import type { SeedContext } from './types';

export async function seedCore(
  prisma: PrismaClient,
  partial: Pick<SeedContext, 'keycloakIds'>,
): Promise<Pick<SeedContext, 'regions' | 'brands' | 'cafes' | 'tiers'>> {
  console.log('\n🌍 Regions & brands...');

  const regionBy = await prisma.region.create({
    data: { name: 'Беларусь', country: 'Беларусь' },
  });
  const regionMinsk = await prisma.region.create({
    data: { name: 'Минск', country: 'Беларусь' },
  });
  const regionBrest = await prisma.region.create({
    data: { name: 'Брест', country: 'Беларусь' },
  });

  const brandTimeCafeBy = await prisma.brand.create({
    data: {
      name: 'ТаймКафе Беларусь',
      description: 'Сеть антикафе с почасовой оплатой',
      logo: IMG.logoA,
      primaryColor: '#2D6A4F',
      secondaryColor: '#40916C',
      accentColor: '#D8F3DC',
      website: 'https://timecafe.by',
      phone: '+375-17-200-10-10',
      email: 'brand.a@timecafe.by',
      status: BrandStatus.ACTIVE,
      isVerified: true,
      verifiedAt: new Date(),
      settings: {
        loyaltyBonusesEnabled: true,
        loyaltyDisplayMode: 'FULL',
      },
    },
  });

  const brandUyutnyChas = await prisma.brand.create({
    data: {
      name: 'Уютный Час',
      description: 'Уютные пространства для работы и отдыха',
      logo: IMG.logoB,
      primaryColor: '#6F4E37',
      secondaryColor: '#A67B5B',
      accentColor: '#F5E6D3',
      website: 'https://uyutnychas.by',
      phone: '+375-162-55-00-00',
      email: 'brand.b@uyutnychas.by',
      status: BrandStatus.ACTIVE,
      isVerified: true,
      verifiedAt: new Date(),
      settings: {
        loyaltyBonusesEnabled: true,
        loyaltyDisplayMode: 'BRIEF',
      },
    },
  });

  const cafeBase = {
    openingHours: OPENING_HOURS,
    occupancyMode: 'PERCENT',
    photos: [IMG.cafe],
  };

  const minskNezavisimosti = await prisma.cafe.create({
    data: {
      ...cafeBase,
      name: 'ТаймКафе — пр. Независимости',
      description: 'Антикафе в центре Минска',
      address: 'пр-т Независимости, 95',
      city: 'Минск',
      street: 'пр-т Независимости',
      latitude: 53.9173,
      longitude: 27.5921,
      photos: [IMG.cafe, IMG.cafe2],
      rating: 4.6,
      reviewsCount: 3,
      brandId: brandTimeCafeBy.id,
      regionId: regionMinsk.id,
    },
  });

  const minskOktyabrskaya = await prisma.cafe.create({
    data: {
      ...cafeBase,
      name: 'ТаймКафе — ул. Октябрьская',
      description: 'Второе антикафе сети в Минске',
      address: 'ул. Октябрьская, 16',
      city: 'Минск',
      street: 'ул. Октябрьская',
      latitude: 53.9025,
      longitude: 27.5618,
      photos: [IMG.cafe2],
      rating: 4.4,
      reviewsCount: 2,
      brandId: brandTimeCafeBy.id,
      regionId: regionMinsk.id,
    },
  });

  const brestCenter = await prisma.cafe.create({
    data: {
      ...cafeBase,
      name: 'Уютный Час — центр Бреста',
      description: 'Антикафе в историческом центре',
      address: 'ул. Советская, 12',
      city: 'Брест',
      street: 'ул. Советская',
      latitude: 52.0976,
      longitude: 23.7341,
      photos: [IMG.cafe3],
      rating: 4.8,
      reviewsCount: 2,
      brandId: brandUyutnyChas.id,
      regionId: regionBrest.id,
    },
  });

  await prisma.systemSettings.upsert({
    where: { id: 'system' },
    create: {
      id: 'system',
      settings: {
        maintenanceMode: false,
        defaultCurrency: 'BYN',
        supportEmail: 'support@timecafe.by',
      },
    },
    update: {},
  });

  await prisma.platformLoyaltySettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      enabled: true,
      accrualDelayHours: 120,
      minTopUpForBonus: 20,
      tierPercentChangeCooldownHours: 24,
      timezone: 'Europe/Minsk',
    },
    update: { enabled: true, timezone: 'Europe/Minsk' },
  });

  const tierDefs = [
    {
      key: 'bronze' as const,
      name: 'Бронзовый',
      bonusPercent: 5,
      sortOrder: 1,
      isDefault: true,
    },
    {
      key: 'silver' as const,
      name: 'Серебряный',
      bonusPercent: 8,
      sortOrder: 2,
      isDefault: false,
    },
    {
      key: 'gold' as const,
      name: 'Золотой',
      bonusPercent: 13,
      sortOrder: 3,
      isDefault: false,
    },
  ];

  const tiers = {} as SeedContext['tiers'];
  for (const t of tierDefs) {
    tiers[t.key] = await prisma.loyaltyTier.create({
      data: {
        name: t.name,
        bonusPercent: t.bonusPercent,
        sortOrder: t.sortOrder,
        isDefault: t.isDefault,
        isActive: true,
      },
    });
  }

  void partial;
  void regionBy;

  return {
    regions: { by: regionBy, minsk: regionMinsk, brest: regionBrest },
    brands: { timeCafeBy: brandTimeCafeBy, uyutnyChas: brandUyutnyChas },
    cafes: { minskNezavisimosti, minskOktyabrskaya, brestCenter },
    tiers,
  };
}
