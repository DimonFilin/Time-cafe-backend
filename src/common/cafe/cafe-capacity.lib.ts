import { PrismaService } from '../../prisma/prisma.service';

export async function computeCafeTotalCapacity(
  prisma: PrismaService,
  cafeId: string,
): Promise<number> {
  const agg = await prisma.cafeRoom.aggregate({
    where: { cafeId, status: 'ACTIVE' },
    _sum: { capacity: true },
  });
  return Math.max(0, agg._sum.capacity ?? 0);
}
