import { Prisma, PrismaClient } from '@prisma/client';
import { CAFES, STOCK } from './fixtures';
import type { ShowcaseCore } from './seed-showcase-core';

const MENU_TEMPLATES = [
  {
    key: 'drinks',
    name: 'Напитки',
    items: [
      {
        key: 'latte',
        name: 'Латте',
        desc: 'Классический с молоком',
        price: 8.5,
      },
      {
        key: 'raf',
        name: 'Раф ванильный',
        desc: 'Сливочный, нежный',
        price: 9.0,
      },
      {
        key: 'tea',
        name: 'Чай ассорти',
        desc: 'Чёрный, зелёный, травяной',
        price: 5.0,
      },
      { key: 'cocoa', name: 'Какао', desc: 'С зефиром по запросу', price: 6.5 },
    ],
  },
  {
    key: 'snacks',
    name: 'Снеки',
    items: [
      {
        key: 'cookie',
        name: 'Печенье овсяное',
        desc: 'Домашняя выпечка',
        price: 4.5,
      },
      {
        key: 'sandwich',
        name: 'Сэндвич',
        desc: 'Курица, салат, соус',
        price: 9.5,
      },
      {
        key: 'muffin',
        name: 'Маффин',
        desc: 'Черника или шоколад',
        price: 6.0,
      },
    ],
  },
];

function roomPolygon(x: number, y: number, w: number, h: number) {
  return {
    type: 'polygon',
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
  };
}

export async function seedShowcaseLayout(
  prisma: PrismaClient,
  core: ShowcaseCore,
  createdById: string,
): Promise<void> {
  console.log('\n☕ Menu & layout (1 room per cafe)...');

  for (const def of CAFES) {
    const cafeId = core.cafes[def.key].id;

    for (const [ci, cat] of MENU_TEMPLATES.entries()) {
      const category = await prisma.cafeMenuCategory.create({
        data: { cafeId, key: cat.key, name: cat.name, sortOrder: ci },
      });
      for (const [ii, item] of cat.items.entries()) {
        await prisma.cafeMenuItem.create({
          data: {
            cafeId,
            categoryId: category.id,
            key: item.key,
            name: item.name,
            description: item.desc,
            price: item.price + (def.photoIdx % 3) * 0.5,
            currency: 'BYN',
            photoUrl:
              cat.key === 'drinks'
                ? STOCK.menuDrinks[ii % STOCK.menuDrinks.length]
                : STOCK.menuFood[ii % STOCK.menuFood.length],
            sortOrder: ii,
          },
        });
      }
    }

    const room = await prisma.cafeRoom.create({
      data: {
        cafeId,
        name: def.roomName,
        description: `Основная комната для бронирования (до ${def.capacity} гостей)`,
        imageUrl: STOCK.rooms[def.photoIdx % STOCK.rooms.length],
        capacity: def.capacity,
        status: 'ACTIVE',
        geometry: roomPolygon(80, 80, 320, 240),
        metadata: { hourlyRate: 12 + def.capacity, minuteRate: 0.35 },
      },
    });

    const layout = await prisma.cafeLayout.create({
      data: {
        cafeId,
        version: 1,
        title: 'Основная схема',
        isPublished: true,
        createdById,
        schema: {
          version: 1,
          rooms: [room.id],
          grid: { width: 900, height: 700 },
        },
      },
    });
    void layout;

    const elements: Prisma.CafeLayoutElementCreateManyInput[] = [];

    elements.push({
      cafeId,
      roomId: room.id,
      elementType: 'ROOM_ZONE',
      name: def.roomName,
      geometry: roomPolygon(80, 80, 320, 240),
      props: { capacity: def.capacity },
    });

    elements.push({
      cafeId,
      roomId: room.id,
      elementType: 'DOOR',
      name: 'Вход',
      geometry: { x: 80, y: 200, w: 40, h: 12 },
      props: { swing: 'in' },
    });

    const windowY = [100, 180, 260];
    for (let i = 0; i < 3; i++) {
      elements.push({
        cafeId,
        roomId: room.id,
        elementType: 'WINDOW',
        name: `Окно ${i + 1}`,
        geometry: { x: 40, y: windowY[i], w: 12, h: 56 },
      });
    }

    elements.push({
      cafeId,
      roomId: room.id,
      elementType: 'TABLE',
      name: 'Стол',
      geometry: { x: 200, y: 180, w: 100, h: 60 },
      props: { seats: def.capacity },
    });

    const chairCount = def.capacity;
    for (let i = 0; i < chairCount; i++) {
      const angle = (i / chairCount) * Math.PI * 2;
      elements.push({
        cafeId,
        roomId: room.id,
        elementType: 'CHAIR',
        name: `Стул ${i + 1}`,
        geometry: {
          x: 200 + 70 * Math.cos(angle),
          y: 200 + 50 * Math.sin(angle),
          w: 28,
          h: 28,
        },
      });
    }

    if (def.equip === 'whiteboard') {
      elements.push({
        cafeId,
        roomId: room.id,
        elementType: 'WHITEBOARD',
        name: 'Маркерная доска',
        geometry: { x: 300, y: 90, w: 90, h: 8 },
      });
      await prisma.cafeRoomAsset.create({
        data: { cafeId, roomId: room.id, name: 'Маркерный набор', quantity: 2 },
      });
    } else {
      elements.push({
        cafeId,
        roomId: room.id,
        elementType: 'TV',
        name: def.equip === 'tv_stand' ? 'Телевизор на тумбе' : 'Телевизор',
        geometry: { x: 320, y: 120, w: 64, h: 40 },
        props: { mount: def.equip === 'tv_stand' ? 'stand' : 'wall' },
      });
      await prisma.cafeRoomAsset.create({
        data: { cafeId, roomId: room.id, name: 'Пульт / HDMI', quantity: 1 },
      });
    }

    await prisma.cafeLayoutElement.createMany({ data: elements });
  }
}
