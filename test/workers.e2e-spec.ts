import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WorkerRole, BrandStatus } from '@prisma/client';
import { KeycloakService } from '../src/modules/auth/services/keycloak.service';
import { createSystemAdmin, createBrandAdmin } from './helpers/test-factories';
import { WorkerListResponseDto } from '../src/modules/workers/dto/worker-list-response.dto';

describe('Workers Endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let keycloakService: KeycloakService;
  const testWorkers: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    keycloakService = moduleFixture.get<KeycloakService>(KeycloakService);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        stopAtFirstError: false,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    if (prisma) {
      for (const email of testWorkers) {
        try {
          const worker = await prisma.workerAccount.findFirst({
            where: { email, deletedAt: null },
          });
          if (worker) {
            await prisma.workerAccount.update({
              where: { id: worker.id },
              data: { deletedAt: new Date() },
            });
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }
    await app.close();
  });

  // Helper to get test factories dependencies
  const getTestFactoriesDeps = () => ({
    app,
    prisma,
    keycloakService,
  });

  describe('POST /auth/workers', () => {
    let systemAdminToken: string;
    let brandAdminToken: string;
    let testBrandId: string;
    let testCafeId: string;
    let otherBrandId: string;
    let otherCafeId: string;

    beforeAll(async () => {
      // Create SYSTEM_ADMIN using helper function
      systemAdminToken = await createSystemAdmin(getTestFactoriesDeps());

      // Create test brand
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Workers',
          email: 'workers@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;

      // Create test region
      const region = await prisma.region.create({
        data: {
          name: 'Test Region',
          country: 'Russia',
        },
      });

      // Create test cafe
      const cafe = await prisma.cafe.create({
        data: {
          name: 'Test Cafe',
          address: '123 Main St',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: testBrandId,
          regionId: region.id,
        },
      });
      testCafeId = cafe.id;

      // Create other brand
      const otherBrand = await prisma.brand.create({
        data: {
          name: 'Other Brand',
          email: 'other@brand.com',
          phone: '+7 (999) 123-45-68',
          address: '456 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      otherBrandId = otherBrand.id;

      // Create other cafe
      const otherCafe = await prisma.cafe.create({
        data: {
          name: 'Other Cafe',
          address: '456 Main St',
          city: 'Moscow',
          latitude: 55.754,
          longitude: 37.6209,
          brandId: otherBrandId,
          regionId: region.id,
        },
      });
      otherCafeId = otherCafe.id;

      // Create BRAND_ADMIN using helper function
      brandAdminToken = await createBrandAdmin(
        getTestFactoriesDeps(),
        systemAdminToken,
        testBrandId,
      );
    });

    it('should register a new worker with SYSTEM_ADMIN role as SYSTEM_ADMIN', async () => {
      const testWorker = {
        email: `worker-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Admin',
        lastName: 'Worker',
        role: WorkerRole.SYSTEM_ADMIN,
      };
      testWorkers.push(testWorker.email);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(testWorker);

      expect([201, 409]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
        expect(response.body).toHaveProperty('expiresIn');
        expect(response.body).toHaveProperty('user');
      }
    }, 30000);

    it('should register CAFE_ADMIN as SYSTEM_ADMIN with valid cafe', async () => {
      const testWorker = {
        email: `cafe-admin-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Cafe',
        lastName: 'Admin',
        role: WorkerRole.CAFE_ADMIN,
        cafeId: testCafeId,
        brandId: testBrandId,
      };
      testWorkers.push(testWorker.email);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(testWorker);

      expect([201, 409]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('user');
      }
    }, 30000);

    it('should register CAFE_ADMIN as BRAND_ADMIN for their brand cafe', async () => {
      const testWorker = {
        email: `cafe-admin-brand-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Cafe',
        lastName: 'Admin',
        role: WorkerRole.CAFE_ADMIN,
        cafeId: testCafeId,
        brandId: testBrandId,
      };
      testWorkers.push(testWorker.email);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send(testWorker);

      expect([201, 409]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body).toHaveProperty('accessToken');
      }
    }, 30000);

    it('should return 403 when BRAND_ADMIN tries to create CAFE_ADMIN for other brand cafe', async () => {
      const testWorker = {
        email: `cafe-admin-other-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Cafe',
        lastName: 'Admin',
        role: WorkerRole.CAFE_ADMIN,
        cafeId: otherCafeId,
        brandId: otherBrandId,
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send(testWorker)
        .expect(403);
    });

    it('should return 400 when CAFE_ADMIN created without cafeId', async () => {
      const testWorker = {
        email: `cafe-admin-no-cafe-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Cafe',
        lastName: 'Admin',
        role: WorkerRole.CAFE_ADMIN,
        brandId: testBrandId,
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(testWorker)
        .expect(400);
    });

    it('should return 404 when CAFE_ADMIN created with non-existent cafe', async () => {
      const testWorker = {
        email: `cafe-admin-fake-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Cafe',
        lastName: 'Admin',
        role: WorkerRole.CAFE_ADMIN,
        cafeId: '00000000-0000-0000-0000-000000000000',
        brandId: testBrandId,
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(testWorker)
        .expect(404);
    });

    it('should return 400 when cafe does not belong to specified brand', async () => {
      const testWorker = {
        email: `cafe-admin-wrong-brand-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Cafe',
        lastName: 'Admin',
        role: WorkerRole.CAFE_ADMIN,
        cafeId: testCafeId,
        brandId: otherBrandId,
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(testWorker)
        .expect(400);
    });

    it('should return 401 for unauthenticated request', async () => {
      const testWorker = {
        email: `worker-unauth-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'Worker',
        role: WorkerRole.WORKER,
        cafeId: testCafeId,
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send(testWorker)
        .expect(401);
    });

    it('should return 403 for regular user trying to create worker', async () => {
      const userEmail = `user-workers-${Date.now()}@test.com`;
      const userResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email: userEmail,
          password: 'User123!@#',
          firstName: 'Regular',
          lastName: 'User',
        });

      const userToken = (userResponse.body as { accessToken: string })
        .accessToken;

      const testWorker = {
        email: `worker-user-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'Worker',
        role: WorkerRole.WORKER,
        cafeId: testCafeId,
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${userToken}`)
        .send(testWorker)
        .expect(403);
    });

    it('should register WORKER as SYSTEM_ADMIN with valid cafe', async () => {
      const testWorker = {
        email: `worker-role-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Regular',
        lastName: 'Worker',
        role: WorkerRole.WORKER,
        cafeId: testCafeId,
      };
      testWorkers.push(testWorker.email);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(testWorker);

      expect([201, 409]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('user');
      }
    }, 30000);

    it('should return 409 if worker already exists', async () => {
      const testWorker = {
        email: `duplicate-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'Worker',
        role: WorkerRole.WORKER,
        cafeId: testCafeId,
      };
      testWorkers.push(testWorker.email);

      const firstRegister = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(testWorker);

      if (firstRegister.status === 409) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else if (firstRegister.status !== 201) {
        throw new Error(
          `First registration failed with status ${firstRegister.status}`,
        );
      }

      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(testWorker)
        .expect(409);
    });

    it('should return 400 for invalid email', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'Worker',
          role: WorkerRole.WORKER,
          cafeId: testCafeId,
        })
        .expect(400);
    });

    it('should return 400 for short password', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
          password: 'short',
          firstName: 'Test',
          lastName: 'Worker',
          role: WorkerRole.WORKER,
          cafeId: testCafeId,
        })
        .expect(400);
    });

    it('should return 400 for invalid role', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'Worker',
          role: 'INVALID_ROLE',
          cafeId: testCafeId,
        })
        .expect(400);
    });

    it('should return 409 if email is already registered as user', async () => {
      const email = `user-worker-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      testWorkers.push(email);

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email,
          password: 'TestPassword123!',
          firstName: 'User',
          lastName: 'Test',
        });

      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          email,
          password: 'TestPassword123!',
          firstName: 'Worker',
          lastName: 'Test',
          role: WorkerRole.WORKER,
          cafeId: testCafeId,
        })
        .expect(409);
    });
  });

  describe('GET /admin/workers', () => {
    let systemAdminToken: string;

    beforeAll(async () => {
      systemAdminToken = await createSystemAdmin(getTestFactoriesDeps());
    });

    it('should return list of workers as SYSTEM_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      const body = response.body as WorkerListResponseDto;

      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page');
      expect(body).toHaveProperty('limit');
      expect(body).toHaveProperty('totalPages');
      expect(Array.isArray(body.items)).toBe(true);
    });

    it('should filter workers by role', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/workers')
        .query({ role: WorkerRole.SYSTEM_ADMIN })
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      const body = response.body as WorkerListResponseDto;

      expect(body.items).toBeDefined();
      if (body.items.length > 0) {
        for (const worker of body.items) {
          expect(worker.role).toBe(WorkerRole.SYSTEM_ADMIN);
        }
      }
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/workers')
        .expect(401);
    });

    it('should return 403 for non-SYSTEM_ADMIN', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand List',
          email: 'list@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      const tempSystemAdminToken = await createSystemAdmin(
        getTestFactoriesDeps(),
      );
      const brandAdminToken = await createBrandAdmin(
        getTestFactoriesDeps(),
        tempSystemAdminToken,
        brand.id,
      );

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/workers')
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .expect(403);
    });
  });

  describe('GET /admin/workers/:id', () => {
    let systemAdminToken: string;
    let testWorkerId: string;

    beforeAll(async () => {
      systemAdminToken = await createSystemAdmin(getTestFactoriesDeps());

      const worker = await prisma.workerAccount.create({
        data: {
          keycloakId: `keycloak-worker-${Date.now()}`,
          email: `worker-get-${Date.now()}@test.com`,
          firstName: 'Test',
          lastName: 'Worker',
          role: WorkerRole.WORKER,
        },
      });

      testWorkerId = worker.id;
    });

    it('should get worker by ID as SYSTEM_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/admin/workers/${testWorkerId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testWorkerId);
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('firstName');
      expect(response.body).toHaveProperty('lastName');
      expect(response.body).toHaveProperty('role');
    });

    it('should return 404 for non-existent worker', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/workers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);
    });
  });

  describe('PATCH /admin/workers/:id', () => {
    let systemAdminToken: string;
    let testWorkerId: string;

    beforeAll(async () => {
      systemAdminToken = await createSystemAdmin(getTestFactoriesDeps());

      const worker = await prisma.workerAccount.create({
        data: {
          keycloakId: `keycloak-worker-update-${Date.now()}`,
          email: `worker-update-${Date.now()}@test.com`,
          firstName: 'Test',
          lastName: 'Worker',
          role: WorkerRole.WORKER,
        },
      });

      testWorkerId = worker.id;
    });

    it('should update worker as SYSTEM_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/admin/workers/${testWorkerId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        })
        .expect(200);

      expect(response.body).toHaveProperty('id', testWorkerId);
      expect(response.body).toHaveProperty('firstName', 'Updated');
      expect(response.body).toHaveProperty('lastName', 'Name');
    });
  });

  describe('DELETE /admin/workers/:id', () => {
    let systemAdminToken: string;
    let testWorkerId: string;

    beforeAll(async () => {
      systemAdminToken = await createSystemAdmin(getTestFactoriesDeps());
    });

    it('should delete worker as SYSTEM_ADMIN', async () => {
      // Create worker through Keycloak first
      const workerEmail = `worker-delete-${Date.now()}@test.com`;
      const password = 'TestPassword123!';

      // Create user in Keycloak
      const keycloakId = await keycloakService.createUser(
        workerEmail,
        password,
      );

      // Create worker account in database
      const worker = await prisma.workerAccount.create({
        data: {
          keycloakId,
          email: workerEmail,
          firstName: 'Test',
          lastName: 'Worker',
          role: WorkerRole.WORKER,
        },
      });

      testWorkerId = worker.id;

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .delete(`/admin/workers/${testWorkerId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      const deletedWorker = await prisma.workerAccount.findUnique({
        where: { id: testWorkerId },
      });

      expect(deletedWorker?.deletedAt).toBeTruthy();
    });
  });

  describe('POST /auth/login for workers', () => {
    let systemAdminToken: string;
    let testCafeId: string;

    beforeAll(async () => {
      // Create SYSTEM_ADMIN
      systemAdminToken = await createSystemAdmin(getTestFactoriesDeps());

      // Create test brand and cafe
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand Login',
          email: 'login@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      const region = await prisma.region.create({
        data: {
          name: 'Test Region Login',
          country: 'Russia',
        },
      });

      const cafe = await prisma.cafe.create({
        data: {
          name: 'Test Cafe Login',
          address: '123 Main St',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: brand.id,
          regionId: region.id,
        },
      });

      testCafeId = cafe.id;
    });

    it('should login worker with valid credentials', async () => {
      const loginEmail = `login-worker-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const password = 'TestPassword123!';
      testWorkers.push(loginEmail);

      const registerResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          email: loginEmail,
          password,
          firstName: 'Test',
          lastName: 'Worker',
          role: WorkerRole.WORKER,
          cafeId: testCafeId,
        });

      if (registerResponse.status === 409) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else if (registerResponse.status !== 201) {
        throw new Error(
          `Registration failed with status ${registerResponse.status}`,
        );
      }

      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/login')
        .send({
          email: loginEmail,
          password,
        })
        .expect(200)
        .expect((res: { body: AuthResponse }) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('user');
        });
    });
  });
});

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
    balance: string;
    createdAt: string;
  };
}
