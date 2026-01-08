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
  createBrandAdmin,
  createCafeAdmin,
  createRegularUser,
  createBrand,
  createCafe,
  createRegion,
  getTestFactoriesDeps,
} from './helpers/test-factories';
import { BrandStatus } from '@prisma/client';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let keycloakService: KeycloakService;
  let systemAdminToken: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let brandAdminToken: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let cafeAdminToken: string;
  let userToken: string;
  let brandId: string;
  let cafeId: string;
  let userId: string;
  let cardId: string;

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

    // Create brand and brand admin
    const brand = await createBrand(deps, {
      status: BrandStatus.ACTIVE,
      isVerified: true,
      verifiedAt: new Date(),
    });
    brandId = brand.id;
    brandAdminToken = await createBrandAdmin(deps, systemAdminToken, brandId);

    // Create region and cafe
    const region = await createRegion(deps);
    const cafe = await createCafe(deps, {
      brandId,
      regionId: region.id,
    });
    cafeId = cafe.id;

    // Create cafe admin
    cafeAdminToken = await createCafeAdmin(
      deps,
      systemAdminToken,
      brandId,
      cafeId,
    );

    // Create regular user
    userToken = await createRegularUser(deps);
    // Decode token to get keycloakId
    const tokenParts = userToken.split('.');
    let keycloakId: string | undefined;
    if (tokenParts.length >= 2) {
      const payload = JSON.parse(
        Buffer.from(tokenParts[1], 'base64').toString('utf-8'),
      );
      keycloakId = payload.sub;
    }
    const user = await prisma.user.findFirst({
      where: { keycloakId: keycloakId || '' },
    });
    if (user) {
      userId = user.id;
    }

    // Add payment card for user
    const card = await prisma.paymentCard.create({
      data: {
        userId: userId,
        last4Digits: '1234',
        cardType: 'visa',
        expiryMonth: 12,
        expiryYear: 2025,
        isDefault: true,
        isActive: true,
        providerToken: 'tok_test_123',
      },
    });
    cardId = card.id;

    // Update user balance for testing
    await prisma.user.update({
      where: { id: userId },
      data: { balance: 5000 },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up orders before each test
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
  });

  describe('POST /orders', () => {
    it('should create order with card payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: cafeId,
          items: [
            {
              itemName: 'Cappuccino',
              quantity: 2,
              unitPrice: 250.0,
            },
            {
              itemName: 'Croissant',
              quantity: 1,
              unitPrice: 150.0,
            },
          ],
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'CARD',
          cardId: cardId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('orderNumber');
      expect(response.body.status).toBe('PENDING'); // Order starts as PENDING
      expect(response.body.totalAmount).toBe(650);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.paymentMethod).toBe('CARD');

      // Wait for payment to process (since PAYMENT_MODE=good by default)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check if order was confirmed after payment
      const updatedOrder = await prisma.order.findUnique({
        where: { id: response.body.id },
      });
      expect(updatedOrder?.status).toBe('CONFIRMED');
      expect(updatedOrder?.paidAt).toBeTruthy();
    });

    it('should create order with balance payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: cafeId,
          items: [
            {
              itemName: 'Latte',
              quantity: 1,
              unitPrice: 200.0,
            },
          ],
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'BALANCE',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('CONFIRMED'); // Balance payment is synchronous
      expect(response.body.totalAmount).toBe(200);
      expect(response.body.paymentMethod).toBe('BALANCE');
      expect(response.body.paidAt).toBeTruthy();

      // Check balance was deducted
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(Number(user?.balance)).toBeLessThan(5000);
    });

    it('should create order with cash payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: cafeId,
          items: [
            {
              itemName: 'Espresso',
              quantity: 1,
              unitPrice: 150.0,
            },
          ],
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'CASH',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('PENDING');
      expect(response.body.paymentMethod).toBe('CASH');
    });

    it('should return 400 if insufficient balance', async () => {
      // Set user balance to low amount
      await prisma.user.update({
        where: { id: userId },
        data: { balance: 100 },
      });

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: cafeId,
          items: [
            {
              itemName: 'Expensive Item',
              quantity: 1,
              unitPrice: 1000.0,
            },
          ],
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'BALANCE',
        })
        .expect(201); // Order is created successfully

      expect(response.body.status).toBe('PENDING'); // But stays PENDING due to failed payment

      // Restore balance
      await prisma.user.update({
        where: { id: userId },
        data: { balance: 5000 },
      });
    });

    it('should return 400 if card ID missing for card payment', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: cafeId,
          items: [
            {
              itemName: 'Coffee',
              quantity: 1,
              unitPrice: 200.0,
            },
          ],
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'CARD',
        })
        .expect(400);
    });

    it('should return 400 if delivery address missing for DELIVERY', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: cafeId,
          items: [
            {
              itemName: 'Coffee',
              quantity: 1,
              unitPrice: 200.0,
            },
          ],
          deliveryType: 'DELIVERY',
          contactPhone: '+375291234567',
          paymentMethod: 'CARD',
          cardId: cardId,
        })
        .expect(400);
    });

    it('should return 401 if not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          cafeId: cafeId,
          items: [
            {
              itemName: 'Coffee',
              quantity: 1,
              unitPrice: 200.0,
            },
          ],
          contactPhone: '+375291234567',
        })
        .expect(401);
    });
  });

  describe('GET /orders', () => {
    beforeEach(async () => {
      // Create test orders

      await (prisma.order as any).create({
        data: {
          orderNumber: 'ORD-2025-000001',
          userId: userId,
          cafeId: cafeId,
          status: 'PENDING',
          totalAmount: 300,
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'CARD',
          items: {
            create: [
              {
                itemName: 'Coffee',
                quantity: 1,
                unitPrice: 300,
                totalPrice: 300,
              },
            ],
          },
        },
      });

      await (prisma.order as any).create({
        data: {
          orderNumber: 'ORD-2025-000002',
          userId: userId,
          cafeId: cafeId,
          status: 'CONFIRMED',
          totalAmount: 500,
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'BALANCE',
          items: {
            create: [
              {
                itemName: 'Latte',
                quantity: 2,
                unitPrice: 250,
                totalPrice: 500,
              },
            ],
          },
        },
      });
    });

    it('should get user orders', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should filter orders by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders?status=PENDING')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(
        response.body.items.every((o: any) => o.status === 'PENDING'),
      ).toBe(true);
    });

    it('should filter orders by cafe', async () => {
      const response = await request(app.getHttpServer())
        .get(`/orders?cafeId=${cafeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.items.every((o: any) => o.cafeId === cafeId)).toBe(
        true,
      );
    });

    it('should paginate orders', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders?page=1&limit=1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(1);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(1);
    });
  });

  describe('GET /orders/:id', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await (prisma.order as any).create({
        data: {
          orderNumber: 'ORD-2025-000003',
          userId: userId,
          cafeId: cafeId,
          status: 'PENDING',
          totalAmount: 400,
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'CARD',
          items: {
            create: [
              {
                itemName: 'Cappuccino',
                quantity: 2,
                unitPrice: 200,
                totalPrice: 400,
              },
            ],
          },
        },
      });
      orderId = order.id;
    });

    it('should get order by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(orderId);
      expect(response.body.items).toHaveLength(1);
    });

    it('should return 404 if order not found', async () => {
      await request(app.getHttpServer())
        .get('/orders/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should return 401 if not authenticated', async () => {
      await request(app.getHttpServer()).get(`/orders/${orderId}`).expect(401);
    });
  });

  describe('POST /orders/:id/cancel', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await (prisma.order as any).create({
        data: {
          orderNumber: 'ORD-2025-000004',
          userId: userId,
          cafeId: cafeId,
          status: 'PENDING',
          totalAmount: 300,
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'CARD',
          items: {
            create: [
              {
                itemName: 'Coffee',
                quantity: 1,
                unitPrice: 300,
                totalPrice: 300,
              },
            ],
          },
        },
      });
      orderId = order.id;
    });

    it('should cancel pending order', async () => {
      const response = await request(app.getHttpServer())
        .post(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Changed my mind' })
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
      expect(response.body.cancellationReason).toBe('Changed my mind');
    });

    it('should return 400 if order cannot be cancelled', async () => {
      // Update order to CONFIRMED
      await (prisma.order as any).update({
        where: { id: orderId },
        data: { status: 'CONFIRMED' },
      });

      await request(app.getHttpServer())
        .post(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Test' })
        .expect(400);
    });
  });

  describe('GET /orders/cafe/:cafeId', () => {
    let freshCafeAdminToken: string;

    beforeEach(async () => {
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      // Recreate systemAdminToken to ensure it's fresh
      const freshSystemAdminToken = await createSystemAdmin(deps);
      // Recreate brandAdminToken to ensure it's fresh
      const freshBrandAdminToken = await createBrandAdmin(
        deps,
        freshSystemAdminToken,
        brandId,
      );
      // Use fresh brandAdminToken to create CAFE_ADMIN
      freshCafeAdminToken = await createCafeAdmin(
        deps,
        freshBrandAdminToken,
        cafeId,
        brandId,
      );
    });

    it('should get cafe orders for cafe admin', async () => {
      const response = await request(app.getHttpServer())
        .get(`/orders/cafe/${cafeId}`)
        .set('Authorization', `Bearer ${freshCafeAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
    });

    it('should return 403 for non-cafe worker', async () => {
      await request(app.getHttpServer())
        .get(`/orders/cafe/${cafeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('PATCH /orders/:id/status', () => {
    let orderId: string;
    let freshCafeAdminToken: string;

    beforeEach(async () => {
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);
      // Recreate systemAdminToken to ensure it's fresh
      const freshSystemAdminToken = await createSystemAdmin(deps);
      // Recreate brandAdminToken to ensure it's fresh
      const freshBrandAdminToken = await createBrandAdmin(
        deps,
        freshSystemAdminToken,
        brandId,
      );
      // Use fresh brandAdminToken to create CAFE_ADMIN
      freshCafeAdminToken = await createCafeAdmin(
        deps,
        freshBrandAdminToken,
        cafeId,
        brandId,
      );
      const order = await (prisma.order as any).create({
        data: {
          orderNumber: 'ORD-2025-000005',
          userId: userId,
          cafeId: cafeId,
          status: 'PENDING',
          totalAmount: 300,
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'CARD',
          paidAt: new Date(), // Mark as paid for testing
          items: {
            create: [
              {
                itemName: 'Coffee',
                quantity: 1,
                unitPrice: 300,
                totalPrice: 300,
              },
            ],
          },
        },
      });
      orderId = order.id;
    });

    it('should update order status to CONFIRMED', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${freshCafeAdminToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      expect(response.body.status).toBe('CONFIRMED');
      expect(response.body.confirmedAt).toBeDefined();
    });

    it('should update order status to COMPLETED', async () => {
      // First confirm
      await (prisma.order as any).update({
        where: { id: orderId },
        data: { status: 'CONFIRMED' },
      });

      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${freshCafeAdminToken}`)
        .send({ status: 'COMPLETED' })
        .expect(200);

      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.completedAt).toBeDefined();
    });

    it('should cancel order with reason', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${freshCafeAdminToken}`)
        .send({
          status: 'CANCELLED',
          cancellationReason: 'Out of stock',
        })
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
      expect(response.body.cancellationReason).toBe('Out of stock');
    });

    it('should return 400 when trying to complete unpaid order', async () => {
      // Create unpaid order
      const unpaidOrder = await (prisma.order as any).create({
        data: {
          orderNumber: 'ORD-2025-TEST-UNPAID',
          userId: userId,
          cafeId: cafeId,
          status: 'CONFIRMED',
          totalAmount: 100,
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'CARD',
          confirmedAt: new Date(),
          items: {
            create: [
              {
                itemName: 'Test Item',
                quantity: 1,
                unitPrice: 100,
                totalPrice: 100,
              },
            ],
          },
        },
      });

      await request(app.getHttpServer())
        .patch(`/orders/${unpaidOrder.id}/status`)
        .set('Authorization', `Bearer ${freshCafeAdminToken}`)
        .send({ status: 'COMPLETED' })
        .expect(400);
    });

    it('should return 400 when trying to complete unconfirmed order', async () => {
      // Create unconfirmed paid order
      const unconfirmedOrder = await (prisma.order as any).create({
        data: {
          orderNumber: 'ORD-2025-TEST-UNCONFIRMED',
          userId: userId,
          cafeId: cafeId,
          status: 'PENDING',
          totalAmount: 100,
          deliveryType: 'IN_CAFE',
          contactPhone: '+375291234567',
          paymentMethod: 'CARD',
          paidAt: new Date(),
          items: {
            create: [
              {
                itemName: 'Test Item',
                quantity: 1,
                unitPrice: 100,
                totalPrice: 100,
              },
            ],
          },
        },
      });

      await request(app.getHttpServer())
        .patch(`/orders/${unconfirmedOrder.id}/status`)
        .set('Authorization', `Bearer ${freshCafeAdminToken}`)
        .send({ status: 'COMPLETED' })
        .expect(400);
    });

    it('should return 400 for invalid status transition', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${freshCafeAdminToken}`)
        .send({ status: 'COMPLETED' })
        .expect(400);
    });

    it('should return 403 for non-cafe worker', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(403);
    });
  });
});
