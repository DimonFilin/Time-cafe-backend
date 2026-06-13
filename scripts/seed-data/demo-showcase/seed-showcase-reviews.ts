import { PrismaClient } from '@prisma/client';
import { CAFES, REVIEW_COMMENTS, STOCK } from './fixtures';
import type { ShowcaseCore } from './seed-showcase-core';
import { getReviewerIds, type ShowcaseUsers } from './seed-showcase-users';

function pickRating(i: number): number {
  const r = [5, 5, 4, 4, 4, 3, 5, 4, 2, 5][i % 10];
  return r;
}

export async function seedShowcaseReviews(
  prisma: PrismaClient,
  core: ShowcaseCore,
  users: ShowcaseUsers,
): Promise<void> {
  console.log('\n⭐ Reviews (50–780 per cafe)...');

  const reviewerIds = getReviewerIds(users);
  let globalIdx = 0;
  const chunk: {
    userId: string;
    cafeId: string;
    rating: number;
    comment: string;
    pros: string[];
    cons: string[];
    photos: string[];
    isVerified: boolean;
    verifiedAt: Date | null;
    createdAt: Date;
  }[] = [];
  const CHUNK_SIZE = 400;

  async function flush() {
    if (!chunk.length) return;
    await prisma.review.createMany({ data: [...chunk] });
    chunk.length = 0;
  }

  for (const def of CAFES) {
    const cafeId = core.cafes[def.key].id;
    const target = def.reviewTarget;
    let sumRating = 0;

    for (let i = 0; i < target; i++) {
      const rating = pickRating(globalIdx + i);
      sumRating += rating;
      const userId = reviewerIds[(globalIdx + i) % reviewerIds.length];
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - (i % 400));
      createdAt.setHours(10 + (i % 10), i % 60, 0, 0);

      chunk.push({
        userId,
        cafeId,
        rating,
        comment: REVIEW_COMMENTS[(globalIdx + i) % REVIEW_COMMENTS.length],
        pros: rating >= 4 ? ['Атмосфера', 'Персонал'] : [],
        cons: rating <= 3 ? ['Шум', 'Ожидание'] : [],
        photos:
          i % 17 === 0 ? [STOCK.cafes[def.photoIdx % STOCK.cafes.length]] : [],
        isVerified: i % 5 === 0,
        verifiedAt: i % 5 === 0 ? createdAt : null,
        createdAt,
      });

      if (chunk.length >= CHUNK_SIZE) {
        await flush();
      }
    }

    globalIdx += target;
    const avg = sumRating / target;
    await prisma.cafe.update({
      where: { id: cafeId },
      data: {
        reviewsCount: target,
        rating: Math.round(avg * 10) / 10,
      },
    });
  }

  await flush();
  console.log(`   Total reviews: ${globalIdx}`);
}
