import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function remapRoomIdsInSchema(
  schema: unknown,
  roomIdMap: Map<string, string>,
): Prisma.InputJsonValue {
  const clone = JSON.parse(JSON.stringify(schema ?? {})) as Record<string, unknown>;
  if (Array.isArray(clone.rooms)) {
    clone.rooms = clone.rooms.map((id) =>
      typeof id === 'string' ? (roomIdMap.get(id) ?? id) : id,
    );
  }
  return toInputJson(clone);
}

async function resolveSourceCafeId(): Promise<string> {
  const fromEnv = process.env.SOURCE_CAFE_ID?.trim();
  if (fromEnv) return fromEnv;

  const byName = await prisma.cafe.findFirst({
    where: {
      deletedAt: null,
      name: { contains: 'Независимости', mode: 'insensitive' },
    },
    select: { id: true, name: true },
  });
  if (!byName) {
    throw new Error('Source cafe not found (set SOURCE_CAFE_ID or name with Независимости)');
  }
  console.log(`Source cafe: ${byName.name} (${byName.id})`);
  return byName.id;
}

async function clearTargetLayout(tx: Prisma.TransactionClient, cafeId: string) {
  await tx.cafeSharedAssetReservation.deleteMany({ where: { cafeId } });
  await tx.cafeLayoutElement.deleteMany({ where: { cafeId } });
  await tx.cafeRoomAsset.deleteMany({ where: { cafeId } });
  await tx.cafeSharedAsset.deleteMany({ where: { cafeId } });
  await tx.cafeLayout.deleteMany({ where: { cafeId } });
  await tx.cafeRoom.deleteMany({ where: { cafeId } });
}

async function copyLayoutToCafe(sourceId: string, targetId: string) {
  const target = await prisma.cafe.findUnique({
    where: { id: targetId },
    select: { id: true, name: true },
  });
  if (!target) {
    console.warn(`Skip unknown cafe ${targetId}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await clearTargetLayout(tx, targetId);

    const rooms = await tx.cafeRoom.findMany({ where: { cafeId: sourceId } });
    const roomIdMap = new Map<string, string>();

    for (const room of rooms) {
      const newId = randomUUID();
      roomIdMap.set(room.id, newId);
      await tx.cafeRoom.create({
        data: {
          id: newId,
          cafeId: targetId,
          name: room.name,
          description: room.description,
          imageUrl: room.imageUrl,
          capacity: room.capacity,
          workingHours: room.workingHours ?? Prisma.JsonNull,
          geometry: toInputJson(room.geometry),
          status: room.status,
          metadata: room.metadata ?? Prisma.JsonNull,
        },
      });
    }

    const elements = await tx.cafeLayoutElement.findMany({
      where: { cafeId: sourceId },
    });
    for (const el of elements) {
      await tx.cafeLayoutElement.create({
        data: {
          cafeId: targetId,
          roomId: el.roomId ? (roomIdMap.get(el.roomId) ?? null) : null,
          elementType: el.elementType,
          name: el.name,
          geometry: toInputJson(el.geometry),
          props: el.props ?? Prisma.JsonNull,
          isOpen: el.isOpen,
          description: el.description,
          createdById: el.createdById,
        },
      });
    }

    const roomAssets = await tx.cafeRoomAsset.findMany({
      where: { cafeId: sourceId },
    });
    for (const asset of roomAssets) {
      const roomId = roomIdMap.get(asset.roomId);
      if (!roomId) continue;
      await tx.cafeRoomAsset.create({
        data: {
          cafeId: targetId,
          roomId,
          name: asset.name,
          description: asset.description,
          quantity: asset.quantity,
          isActive: asset.isActive,
          metadata: asset.metadata ?? Prisma.JsonNull,
        },
      });
    }

    const sharedAssets = await tx.cafeSharedAsset.findMany({
      where: { cafeId: sourceId },
    });
    for (const shared of sharedAssets) {
      await tx.cafeSharedAsset.create({
        data: {
          cafeId: targetId,
          name: shared.name,
          description: shared.description,
          totalQuantity: shared.totalQuantity,
          isActive: shared.isActive,
          metadata: shared.metadata ?? Prisma.JsonNull,
        },
      });
    }

    const layouts = await tx.cafeLayout.findMany({
      where: { cafeId: sourceId },
      orderBy: { updatedAt: 'desc' },
    });
    for (const layout of layouts) {
      await tx.cafeLayout.create({
        data: {
          cafeId: targetId,
          version: layout.version,
          title: layout.title,
          schema: remapRoomIdsInSchema(layout.schema, roomIdMap),
          previewUrl: layout.previewUrl,
          isPublished: layout.isPublished,
          createdById: layout.createdById,
        },
      });
    }

    await tx.cafe.update({
      where: { id: targetId },
      data: { layoutVersion: { increment: 1 } },
    });
  });

  const [roomCount, elementCount] = await Promise.all([
    prisma.cafeRoom.count({ where: { cafeId: targetId } }),
    prisma.cafeLayoutElement.count({ where: { cafeId: targetId } }),
  ]);
  console.log(`  ✓ ${target.name}: ${roomCount} rooms, ${elementCount} elements`);
}

async function main() {
  const sourceId = await resolveSourceCafeId();
  const onlyTargets = process.env.TARGET_CAFE_IDS?.split(',').map((s) => s.trim()).filter(Boolean);

  const targets = onlyTargets?.length
    ? onlyTargets
    : (
        await prisma.cafe.findMany({
          where: { deletedAt: null, NOT: { id: sourceId } },
          select: { id: true },
          orderBy: { name: 'asc' },
        })
      ).map((c) => c.id);

  console.log(`Copying layout from ${sourceId} to ${targets.length} cafe(s)...`);

  for (const targetId of targets) {
    await copyLayoutToCafe(sourceId, targetId);
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
