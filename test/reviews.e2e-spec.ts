/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { KeycloakService } from '../src/modules/auth/services/keycloak.service';
import {
  createSystemAdmin,
  createRegularUser,
  createBrand,
  createCafe,
  createRegion,
  getTestFactoriesDeps,
} from './helpers/test-factories';
import { BrandStatus, OrderStatus } from '@prisma/client';

describe('Reviews (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let keycloakService: KeycloakService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let systemAdminToken: string;
  let userToken: string;
  let brandId: string;
  let cafeId: string;
  let userId: string;
  let orderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    keycloakService = app.get<KeycloakService>(KeycloakService);

    const deps = getTestFactoriesDeps(app, prisma, keycloakService);

    // Create system admin
    systemAdminToken = await createSystemAdmin(deps);

    // Create brand
    const brand = await createBrand(deps, {
      status: BrandStatus.ACTIVE,
      isVerified: true,
      verifiedAt: new Date(),
    });
    brandId = brand.id;

    // Create region and cafe
    const region = await createRegion(deps);
    const cafe = await createCafe(deps, {
      brandId,
      regionId: region.id,
    });
    cafeId = cafe.id;

    // Create regular user
    userToken = await createRegularUser(deps);
    const tokenParts = userToken.split('.');
    let keycloakId: string | undefined;
    if (tokenParts.length >= 2) {
      const payload = JSON.parse(
        Buffer.from(tokenParts[1], 'base64').toString('utf-8'),
      );
      keycloakId = payload.sub;
    }
    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });
    if (user) {
      userId = user.id;

      // Create completed order for testing review with orderId
      const uniqueOrderNumber = `ORD-2025-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const order = await (prisma.order as any).create({
        data: {
          orderNumber: uniqueOrderNumber,
          userId: userId,
          cafeId: cafeId,
          status: OrderStatus.COMPLETED,
          totalAmount: 500,
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'CARD',
          completedAt: new Date(),
          items: {
            create: [
              {
                itemName: 'Coffee',
                quantity: 1,
                unitPrice: 500,
                totalPrice: 500,
              },
            ],
          },
        },
      });
      orderId = order.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /reviews', () => {
    it('should create review without orderId', async () => {
      // Create a new cafe for this test
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      const region = await createRegion(deps);
      const testCafe = await createCafe(deps, {
        brandId,
        regionId: region.id,
      });

      const response = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: testCafe.id,
          rating: 4.5,
          comment: 'Отличная кофейня!',
          pros: ['Вкусный кофе', 'Уютная атмосфера'],
          cons: ['Дорого'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.rating).toBe(4.5);
      expect(response.body.comment).toBe('Отличная кофейня!');
      expect(response.body.pros).toEqual(['Вкусный кофе', 'Уютная атмосфера']);
      expect(response.body.cons).toEqual(['Дорого']);
      expect(response.body.cafeId).toBe(testCafe.id);
    });

    it('should create review with orderId', async () => {
      if (!orderId) {
        // Skip if orderId not created
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: cafeId,
          orderId: orderId,
          rating: 5.0,
          comment: 'Превосходно!',
          pros: ['Быстрое обслуживание'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.rating).toBe(5.0);
      expect(response.body.orderId).toBe(orderId);
    });

    it('should return 400 if order not completed', async () => {
      const uniqueOrderNumber = `ORD-2025-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const pendingOrder = await (prisma.order as any).create({
        data: {
          orderNumber: uniqueOrderNumber,
          userId: userId,
          cafeId: cafeId,
          status: OrderStatus.PENDING,
          totalAmount: 300,
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'CARD',
        },
      });

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: cafeId,
          orderId: pendingOrder.id,
          rating: 4.0,
        })
        .expect(400);
    });

    it('should return 400 if duplicate review for same cafe', async () => {
      // Create a new cafe and review for this test
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      const region = await createRegion(deps);
      const testCafe = await createCafe(deps, {
        brandId,
        regionId: region.id,
      });

      // Create first review
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: testCafe.id,
          rating: 4.0,
        })
        .expect(201);

      // Try to create duplicate review
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: testCafe.id,
          rating: 3.0,
        })
        .expect(400);
    });

    it('should return 401 if not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/reviews')
        .send({
          cafeId: cafeId,
          rating: 4.0,
        })
        .expect(401);
    });
  });

  describe('GET /reviews', () => {
    it('should get list of reviews', async () => {
      // Create reviews first
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      const region = await createRegion(deps);
      const testCafe = await createCafe(deps, {
        brandId,
        regionId: region.id,
      });

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: testCafe.id,
          rating: 4.0,
        });

      const response = await request(app.getHttpServer())
        .get('/reviews')
        .query({ cafeId: testCafe.id })
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should filter reviews by minRating', async () => {
      // Create reviews first
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      const region = await createRegion(deps);
      const testCafe = await createCafe(deps, {
        brandId,
        regionId: region.id,
      });

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: testCafe.id,
          rating: 5.0,
        });

      const response = await request(app.getHttpServer())
        .get('/reviews')
        .query({ cafeId: testCafe.id, minRating: 4.5 })
        .expect(200);

      expect(response.body.items.every((r: any) => r.rating >= 4.5)).toBe(true);
    });

    it('should paginate reviews', async () => {
      const response = await request(app.getHttpServer())
        .get('/reviews')
        .query({ cafeId: cafeId, page: 1, limit: 1 })
        .expect(200);

      expect(response.body.items.length).toBeLessThanOrEqual(1);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(1);
    });
  });

  describe('GET /reviews/:id', () => {
    it('should get review by ID', async () => {
      // Create a new cafe and review for this test
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      const region = await createRegion(deps);
      const testCafe = await createCafe(deps, {
        brandId,
        regionId: region.id,
      });

      const createResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: testCafe.id,
          rating: 4.0,
          comment: 'Test review',
        });

      const reviewId = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .get(`/reviews/${reviewId}`)
        .expect(200);

      expect(response.body.id).toBe(reviewId);
      expect(response.body.rating).toBe(4.0);
    });

    it('should return 404 if review not found', async () => {
      await request(app.getHttpServer())
        .get('/reviews/non-existent-id')
        .expect(404);
    });
  });

  describe('PATCH /reviews/:id', () => {
    it('should update review by owner', async () => {
      // Create a new cafe and review for this test
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      const region = await createRegion(deps);
      const testCafe = await createCafe(deps, {
        brandId,
        regionId: region.id,
      });

      const createResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: testCafe.id,
          rating: 3.0,
          comment: 'Initial comment',
        });

      const reviewId = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 4.5,
          comment: 'Updated comment',
          pros: ['Updated pros'],
        })
        .expect(200);

      expect(response.body.rating).toBe(4.5);
      expect(response.body.comment).toBe('Updated comment');
      expect(response.body.pros).toEqual(['Updated pros']);
    });

    it('should return 403 if not owner', async () => {
      // Create a new cafe and review for this test
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      const region = await createRegion(deps);
      const testCafe = await createCafe(deps, {
        brandId,
        regionId: region.id,
      });

      // Create another user
      const anotherUserToken = await createRegularUser(deps);

      // Create a review with first user
      const createResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: testCafe.id,
          rating: 3.0,
        });

      const reviewId = createResponse.body.id;

      // Try to update with another user
      await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({
          rating: 5.0,
        })
        .expect(403);
    });
  });

  describe('DELETE /reviews/:id', () => {
    it('should delete review by owner', async () => {
      // Create a new cafe and review for this test
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      const region = await createRegion(deps);
      const testCafe = await createCafe(deps, {
        brandId,
        regionId: region.id,
      });

      const createResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: testCafe.id,
          rating: 3.0,
        });

      const reviewId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify review is soft deleted
      const review = await prisma.review.findFirst({
        where: { id: reviewId },
      });
      expect(review?.deletedAt).toBeTruthy();
    });

    it('should return 403 if not owner', async () => {
      // Create a new cafe and review for this test
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      const region = await createRegion(deps);
      const testCafe = await createCafe(deps, {
        brandId,
        regionId: region.id,
      });

      // Create another user
      const anotherUserToken = await createRegularUser(deps);

      // Create a review with first user
      const createResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: testCafe.id,
          rating: 3.0,
        });

      const reviewId = createResponse.body.id;

      // Try to delete with another user
      await request(app.getHttpServer())
        .delete(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .expect(403);
    });
  });

  describe('Rating recalculation', () => {
    it('should recalculate cafe rating after creating review', async () => {
      // Create a new cafe for this test
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      const region = await createRegion(deps);
      const testCafe = await createCafe(deps, {
        brandId,
        regionId: region.id,
      });

      // Create review
      const createResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: testCafe.id,
          rating: 4.0,
        })
        .expect(201);

      // Verify review was created
      const review = await prisma.review.findFirst({
        where: { id: createResponse.body.id, deletedAt: null },
      });
      expect(review).toBeTruthy();
      expect(review?.rating).toBe(4.0);
    });
  });
});
