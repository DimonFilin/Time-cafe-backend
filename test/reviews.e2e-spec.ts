import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { KeycloakService } from '../src/modules/auth/services/keycloak.service';
import {
  getTestFactoriesDeps,
  createRegion,
  createBrand,
  createCafe,
  createRegularUser,
} from './helpers/test-factories';

describe('Reviews (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let keycloakService: KeycloakService;
  let deps: any;
  let systemAdminToken: string;
  let userToken: string;
  let brandId: string;
  let cafeId: string;
  let userId: string;
  let orderId: string;
  let testRequest: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    keycloakService = moduleFixture.get<KeycloakService>(KeycloakService);

    await app.init();

    deps = getTestFactoriesDeps(app, prisma, keycloakService);
    testRequest = global.createTestRequest(app);

    // Create test data
    const region = await createRegion(deps);
    const brand = await createBrand(deps);
    const cafe = await createCafe(deps, {
      brandId: brand.id,
      regionId: region.id,
    });

    // Create user and get token
    const userEmail = `user-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
    const password = 'User123!@#';

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: userEmail,
        password,
        firstName: 'Regular',
        lastName: 'User',
      })
      .expect(201);

    // Get user data by email
    const user = await prisma.user.findFirst({ where: { email: userEmail } });
    if (!user) throw new Error('User not found');

    // Login to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: userEmail,
        password,
      })
      .expect(200);

    userToken = loginResponse.body.accessToken;
    const userIdLocal = user.id;

    // Create order manually
    const order = await prisma.order.create({
      data: {
        userId: userIdLocal,
        cafeId: cafe.id,
        orderNumber: `ORD-${Date.now()}`,
        totalAmount: 100,
        status: 'COMPLETED',
      },
    });

    brandId = brand.id;
    cafeId = cafe.id;
    orderId = order.id;
    userId = userIdLocal;
  });

  afterAll(async () => {
    if (prisma) {
      // Clean up test data in correct order
      await prisma.review.deleteMany({
        where: {
          OR: [
            { user: { email: { contains: '@test.com' } } },
            { user: { email: { contains: 'test-' } } },
            { cafe: { name: { contains: 'Test' } } },
          ],
        },
      });
      await prisma.order.deleteMany({
        where: {
          OR: [
            { user: { email: { contains: '@test.com' } } },
            { user: { email: { contains: 'test-' } } },
          ],
        },
      });
      await prisma.cafe.deleteMany({
        where: {
          OR: [{ name: { contains: 'Test' } }],
        },
      });
      await prisma.brand.deleteMany({
        where: {
          OR: [{ name: { contains: 'Test' } }],
        },
      });
      await prisma.transaction.deleteMany({
        where: {
          OR: [
            { user: { email: { contains: '@test.com' } } },
            { user: { email: { contains: 'test-' } } },
          ],
        },
      });
      await prisma.paymentCard.deleteMany({
        where: {
          OR: [
            { user: { email: { contains: '@test.com' } } },
            { user: { email: { contains: 'test-' } } },
          ],
        },
      });
      await prisma.user.deleteMany({
        where: {
          OR: [
            { email: { contains: '@test.com' } },
            { email: { contains: 'test-' } },
          ],
        },
      });
    }
    // Clean up connections
    await global.cleanupTestConnections();
    await app.close();
  });

  describe('POST /reviews', () => {
    it('should create review without orderId', async () => {
      const response = await testRequest
        .post('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cafeId: cafeId,
          rating: 4.5,
          comment: 'Отличная кофейня!',
        })
        .expect(201);

      const body = response.body;
      expect(body).toHaveProperty('id');
      expect(body.rating).toBe(4.5);
      expect(body.comment).toBe('Отличная кофейня!');
    });
  });

  describe('GET /reviews', () => {
    it('should get reviews', async () => {
      const response = await testRequest
        .get('/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Response can be an array or an object with pagination
      expect(response.body).toBeDefined();
      if (Array.isArray(response.body)) {
        expect(Array.isArray(response.body)).toBe(true);
      } else {
        expect(response.body).toHaveProperty('items');
        expect(Array.isArray(response.body.items)).toBe(true);
      }
    });
  });
});
