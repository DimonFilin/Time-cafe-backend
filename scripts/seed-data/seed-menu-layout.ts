import { PrismaClient } from '@prisma/client';
import { IMG } from './fixtures';
import type { SeedContext } from './types';

type CafeMenuSeed = {
  categories: {
    key: string;
    name: string;
    items: { key: string; name: string; price: number }[];
  }[];
};

const MENU_BY_CAFE: CafeMenuSeed = {
  categories: [
    {
      key: 'drinks',
      name: 'Напитки',
      items: [
        { key: 'latte', name: 'Латте', price: 8.5 },
        { key: 'cappuccino', name: 'Капучино', price: 8.0 },
        { key: 'tea', name: 'Чай', price: 5.0 },
      ],
    },
    {
      key: 'snacks',
      name: 'Снеки',
      items: [
        { key: 'cookie', name: 'Печенье', price: 4.5 },
        { key: 'muffin', name: 'Маффин', price: 6.0 },
      ],
    },
  ],
};

async function seedCafeMenuAndLayout(
  prisma: PrismaClient,
  cafeId: string,
  workerId: string,
) {
  const menuItems: { id: string; name: string; price: number }[] = [];

  for (const [ci, cat] of MENU_BY_CAFE.categories.entries()) {
    const category = await prisma.cafeMenuCategory.create({
      data: {
        cafeId,
        key: cat.key,
        name: cat.name,
        sortOrder: ci,
      },
    });
    for (const [ii, item] of cat.items.entries()) {
      const row = await prisma.cafeMenuItem.create({
        data: {
          cafeId,
          categoryId: category.id,
          key: item.key,
          name: item.name,
          price: item.price,
          currency: 'BYN',
          photoUrl: ii % 2 === 0 ? IMG.drink : IMG.snack,
          sortOrder: ii,
        },
      });
      menuItems.push({ id: row.id, name: row.name, price: Number(row.price) });
    }
  }

  const roomMain = await prisma.cafeRoom.create({
    data: {
      cafeId,
      name: 'Зал A',
      description: 'Основной зал',
      imageUrl: IMG.room,
      capacity: 24,
      status: 'ACTIVE',
    },
  });

  const roomQuiet = await prisma.cafeRoom.create({
    data: {
      cafeId,
      name: 'Тихая комната',
      description: 'Для работы',
      imageUrl: IMG.room,
      capacity: 8,
      status: 'ACTIVE',
    },
  });

  await prisma.cafeLayout.create({
    data: {
      cafeId,
      version: 1,
      title: 'Основная схема',
      isPublished: true,
      createdById: workerId,
      schema: {
        version: 1,
        rooms: [roomMain.id, roomQuiet.id],
        grid: { width: 800, height: 600 },
      },
    },
  });

  await prisma.cafeLayoutElement.createMany({
    data: [
      {
        cafeId,
        roomId: roomMain.id,
        elementType: 'TABLE',
        name: 'Стол 1',
        geometry: { x: 100, y: 100, w: 80, h: 80 },
      },
      {
        cafeId,
        roomId: roomMain.id,
        elementType: 'TABLE',
        name: 'Стол 2',
        geometry: { x: 220, y: 100, w: 80, h: 80 },
      },
    ],
  });

  await prisma.cafeRoomAsset.create({
    data: {
      cafeId,
      roomId: roomMain.id,
      name: 'Проектор',
      quantity: 1,
    },
  });

  const shared = await prisma.cafeSharedAsset.create({
    data: {
      cafeId,
      name: 'Настольная игра',
      totalQuantity: 3,
    },
  });

  const start = new Date();
  start.setDate(start.getDate() + 2);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  await prisma.cafeSharedAssetReservation.create({
    data: {
      cafeId,
      sharedAssetId: shared.id,
      roomId: roomMain.id,
      startAt: start,
      endAt: end,
      quantity: 1,
    },
  });

  return { roomMain, roomQuiet, menuItems };
}

export async function seedMenuLayout(
  prisma: PrismaClient,
  ctx: Pick<SeedContext, 'cafes' | 'workers'>,
): Promise<Record<string, Awaited<ReturnType<typeof seedCafeMenuAndLayout>>>> {
  console.log('\n☕ Menu, rooms, layouts...');
  const out: Record<
    string,
    Awaited<ReturnType<typeof seedCafeMenuAndLayout>>
  > = {};

  for (const [key, cafe] of Object.entries(ctx.cafes)) {
    const adminWorker =
      key === 'minskOktyabrskaya'
        ? ctx.workers.minsk2Admin
        : key === 'brestCenter'
          ? ctx.workers.brestAdmin
          : ctx.workers.multiacc[2];
    out[cafe.id] = await seedCafeMenuAndLayout(prisma, cafe.id, adminWorker.id);
  }

  return out;
}
