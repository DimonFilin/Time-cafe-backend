import { BrandStatus, PrismaClient } from '@prisma/client';
import { BRANDS, CAFES, OPENING_HOURS, STOCK } from './fixtures';

const REGION_NAMES: Record<string, { name: string; country: string }> = {
  minsk: { name: 'Минск', country: 'Беларусь' },
  brest: { name: 'Брест', country: 'Беларусь' },
  gomel: { name: 'Гомель', country: 'Беларусь' },
  grodno: { name: 'Гродно', country: 'Беларусь' },
  vitebsk: { name: 'Витебск', country: 'Беларусь' },
  mogilev: { name: 'Могилёв', country: 'Беларусь' },
};

export type ShowcaseCore = {
  regions: Record<string, { id: string }>;
  brands: Record<string, { id: string; name: string }>;
  cafes: Record<string, { id: string; name: string; brandKey: string }>;
  tiers: Record<'bronze' | 'silver' | 'gold', { id: string }>;
};

export async function seedShowcaseCore(
  prisma: PrismaClient,
): Promise<ShowcaseCore> {
  console.log('\n🌍 Regions, brands, cafes (showcase)...');

  const regionBy = await prisma.region.create({
    data: { name: 'Беларусь', country: 'Беларусь' },
  });

  const regions: Record<string, { id: string }> = { by: regionBy };
  for (const [key, meta] of Object.entries(REGION_NAMES)) {
    regions[key] = await prisma.region.create({ data: meta });
  }

  const brands: ShowcaseCore['brands'] = {};
  for (const b of BRANDS) {
    const row = await prisma.brand.create({
      data: {
        name: b.name,
        description: b.description,
        logo: STOCK.logos[b.logoIdx],
        primaryColor: b.primaryColor,
        secondaryColor: b.secondaryColor,
        accentColor: b.accentColor,
        website: b.website,
        phone: b.phone,
        email: b.email,
        status: BrandStatus.ACTIVE,
        isVerified: true,
        verifiedAt: new Date(),
        settings: {
          loyaltyBonusesEnabled: true,
          loyaltyDisplayMode: b.key === 'uyutny' ? 'BRIEF' : 'FULL',
        },
      },
    });
    brands[b.key] = { id: row.id, name: row.name };
  }

  const cafes: ShowcaseCore['cafes'] = {};
  for (const c of CAFES) {
    const photo = STOCK.cafes[c.photoIdx];
    const row = await prisma.cafe.create({
      data: {
        name: c.name,
        description: c.description,
        address: c.address,
        city: c.city,
        street: c.street,
        latitude: c.lat,
        longitude: c.lng,
        phone: c.phone,
        email: c.email,
        photos: [photo, STOCK.cafes[(c.photoIdx + 3) % STOCK.cafes.length]],
        rating: 4.2 + (c.photoIdx % 7) * 0.1,
        reviewsCount: 0,
        brandId: brands[c.brandKey].id,
        regionId: regions[c.regionKey].id,
        openingHours: OPENING_HOURS,
        occupancyMode: 'PERCENT',
        layoutVersion: 1,
        chatSettings: { enabled: true, notificationMode: 'ALL_WORKERS' },
      },
    });
    cafes[c.key] = { id: row.id, name: row.name, brandKey: c.brandKey };
  }

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
    update: { enabled: true },
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
  const tiers = {} as ShowcaseCore['tiers'];
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

  return { regions, brands, cafes, tiers };
}
