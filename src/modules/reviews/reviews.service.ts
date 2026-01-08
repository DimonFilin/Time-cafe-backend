/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { ReviewListQueryDto } from './dto/review-list-query.dto';
import { ReviewListResponseDto } from './dto/review-list-response.dto';
import { Prisma, OrderStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Create review for cafe
   */
  async create(
    keycloakId: string,
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate cafe exists
    const cafe = await this.prisma.cafe.findFirst({
      where: {
        id: createReviewDto.cafeId,
        deletedAt: null,
      },
    });

    if (!cafe) {
      throw new NotFoundException('Cafe not found');
    }

    // If orderId provided, validate order exists and is completed
    if (createReviewDto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: {
          id: createReviewDto.orderId,
          userId: user.id,
          cafeId: createReviewDto.cafeId,
          status: OrderStatus.COMPLETED,
        },
      });

      if (!order) {
        throw new BadRequestException(
          'Order not found or not completed. You can only review completed orders.',
        );
      }

      // Check if review already exists for this order
      const existingReview = await this.prisma.review.findFirst({
        where: {
          orderId: createReviewDto.orderId,
        },
      });

      if (existingReview) {
        throw new BadRequestException('Review already exists for this order');
      }
    }

    // Check if user already reviewed this cafe (if no orderId)
    if (!createReviewDto.orderId) {
      const existingReview = await this.prisma.review.findFirst({
        where: {
          userId: user.id,
          cafeId: createReviewDto.cafeId,
          deletedAt: null,
        },
      });

      if (existingReview) {
        throw new BadRequestException(
          'You have already reviewed this cafe. Update your existing review instead.',
        );
      }
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        userId: user.id,
        cafeId: createReviewDto.cafeId,
        orderId: createReviewDto.orderId || null,
        rating: createReviewDto.rating,
        comment: createReviewDto.comment || null,
        pros: createReviewDto.pros || [],
        cons: createReviewDto.cons || [],
        photos: createReviewDto.photos || [],
        isVerified: false,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Recalculate cafe rating
    await this.recalculateCafeRating(createReviewDto.cafeId);

    return this.mapToResponseDto(review);
  }

  /**
   * Get reviews for cafe
   */
  async findAll(query: ReviewListQueryDto): Promise<ReviewListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      deletedAt: null,
    };

    if (query.cafeId) {
      where.cafeId = query.cafeId;
    }

    if (query.minRating !== undefined) {
      where.rating = {
        gte: query.minRating,
      };
    }

    if (query.verifiedOnly) {
      where.isVerified = true;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: reviews.map((review) => this.mapToResponseDto(review)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get review by ID
   */
  async findOne(reviewId: string): Promise<ReviewResponseDto> {
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return this.mapToResponseDto(review);
  }

  /**
   * Update review (only by owner)
   */
  async update(
    reviewId: string,
    keycloakId: string,
    updateDto: Partial<CreateReviewDto>,
  ): Promise<ReviewResponseDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        deletedAt: null,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== user.id) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    const updatedReview = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: updateDto.rating ?? review.rating,
        comment: updateDto.comment ?? review.comment,
        pros: updateDto.pros ?? review.pros,
        cons: updateDto.cons ?? review.cons,
        photos: updateDto.photos ?? review.photos,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Recalculate cafe rating
    await this.recalculateCafeRating(review.cafeId);

    return this.mapToResponseDto(updatedReview);
  }

  /**
   * Delete review (soft delete, only by owner)
   */
  async remove(reviewId: string, keycloakId: string): Promise<void> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        deletedAt: null,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== user.id) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        deletedAt: new Date(),
      },
    });

    // Recalculate cafe rating
    await this.recalculateCafeRating(review.cafeId);
  }

  /**
   * Recalculate cafe rating based on all verified reviews
   */
  private async recalculateCafeRating(cafeId: string): Promise<void> {
    const reviews = await this.prisma.review.findMany({
      where: {
        cafeId,
        deletedAt: null,
        isVerified: true,
      },
      select: {
        rating: true,
      },
    });

    if (reviews.length === 0) {
      // If no verified reviews, set rating to 0
      await this.prisma.cafe.update({
        where: { id: cafeId },
        data: {
          rating: 0,
          reviewsCount: 0,
        },
      });
      return;
    }

    const totalRating = reviews.reduce(
      (sum, review) => sum + Number(review.rating),
      0,
    );
    const averageRating = totalRating / reviews.length;

    await this.prisma.cafe.update({
      where: { id: cafeId },
      data: {
        rating: averageRating,
        reviewsCount: reviews.length,
      },
    });
  }

  /**
   * Map review to response DTO
   */
  private mapToResponseDto(review: any): ReviewResponseDto {
    return {
      id: review.id,
      userId: review.userId,
      userName: `${review.user.firstName} ${review.user.lastName}`,
      cafeId: review.cafeId,
      orderId: review.orderId || undefined,
      rating: Number(review.rating),
      comment: review.comment || undefined,
      pros: review.pros || [],
      cons: review.cons || [],
      photos: review.photos || [],
      isVerified: review.isVerified,
      verifiedAt: review.verifiedAt || undefined,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}
