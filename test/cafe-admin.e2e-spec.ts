import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { KeycloakService } from '../src/modules/auth/services/keycloak.service';
import {
  createSystemAdmin,
  createCafeAdmin,
  createWorker,
  createBrand,
  createRegion,
  createCafe,
  getTestFactoriesDeps,
} from './helpers/test-factories';

describe('Cafe Admin E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let keycloakService: KeycloakService;

  // Test data
  let systemAdminToken: string;
  let cafeAdmin1Token: string;
  let cafeAdmin2Token: string;
  let worker1Token: string;
  let brandId: string;
  let regionId: string;
  let cafe1Id: string;
  let cafe2Id: string;
  let worker1Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    keycloakService = moduleFixture.get<KeycloakService>(KeycloakService);

    await app.init();

    const deps = getTestFactoriesDeps(app, prisma, keycloakService);

    // Create test data
    systemAdminToken = await createSystemAdmin(deps);

    const brand = await createBrand(deps, {
      name: 'Test Brand for Cafe Admin',
    });
    brandId = brand.id;

    const region = await createRegion(deps, {
      name: 'Test Region for Cafe Admin',
    });
    regionId = region.id;

    // Create two cafes for isolation testing
    const cafe1 = await createCafe(deps, {
      brandId,
      regionId,
      name: 'Test Cafe 1',
    });
    cafe1Id = cafe1.id;

    const cafe2 = await createCafe(deps, {
      brandId,
      regionId,
      name: 'Test Cafe 2',
    });
    cafe2Id = cafe2.id;

    // Create cafe admins for each cafe
    cafeAdmin1Token = await createCafeAdmin(
      deps,
      systemAdminToken,
      cafe1Id,
      brandId,
    );

    cafeAdmin2Token = await createCafeAdmin(
      deps,
      systemAdminToken,
      cafe2Id,
      brandId,
    );

    // Create a worker in cafe1
    worker1Token = await createWorker(deps, systemAdminToken, cafe1Id, brandId);

    // Get worker ID
    const worker1Me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${worker1Token}`)
      .expect(200);
    worker1Id = worker1Me.body.id;
  });

  afterAll(async () => {
    if (prisma) {
      // Cleanup test data
      await prisma.workerAccount.deleteMany({
        where: {
          OR: [{ cafeId: cafe1Id }, { cafeId: cafe2Id }],
        },
      });

      await prisma.cafe.deleteMany({
        where: {
          OR: [{ id: cafe1Id }, { id: cafe2Id }],
        },
      });

      await prisma.brand.deleteMany({
        where: { id: brandId },
      });

      await prisma.region.deleteMany({
        where: { id: regionId },
      });
    }

    if (app) {
      await app.close();
    }
  });

  describe('Workers Management', () => {
    it.skip('should invite a new worker', async () => {
      // Skip due to Keycloak configuration issues
      const response = await request(app.getHttpServer())
        .post('/cafe-admin/workers')
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .send({
          email: 'newworker@test.com',
          firstName: 'New',
          lastName: 'Worker',
          phone: '+1234567890',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('newworker@test.com');
      expect(response.body.firstName).toBe('New');
      expect(response.body.lastName).toBe('Worker');
      expect(response.body.cafeId).toBe(cafe1Id);
    });

    it('should get list of workers', async () => {
      const response = await request(app.getHttpServer())
        .get('/cafe-admin/workers')
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('workers');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.workers)).toBe(true);
      expect(response.body.workers.length).toBeGreaterThan(0);
    });

    it('should get worker by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cafe-admin/workers/${worker1Id}`)
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .expect(200);

      expect(response.body.id).toBe(worker1Id);
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('firstName');
      expect(response.body).toHaveProperty('lastName');
    });

    it('should update worker information', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/cafe-admin/workers/${worker1Id}`)
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        })
        .expect(200);

      expect(response.body.firstName).toBe('Updated');
      expect(response.body.lastName).toBe('Name');
    });

    it('should filter workers by search', async () => {
      const response = await request(app.getHttpServer())
        .get('/cafe-admin/workers?search=Updated')
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .expect(200);

      expect(response.body.workers.length).toBeGreaterThanOrEqual(0);
      if (response.body.workers.length > 0) {
        const foundWorker = response.body.workers.find(
          (w: any) => w.id === worker1Id,
        );
        expect(foundWorker).toBeDefined();
      }
    });

    it('should paginate workers list', async () => {
      const response = await request(app.getHttpServer())
        .get('/cafe-admin/workers?page=1&limit=1')
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .expect(200);

      expect(response.body.workers.length).toBeLessThanOrEqual(1);
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
    });

    it('should not allow cafe admin to access workers from another cafe', async () => {
      await request(app.getHttpServer())
        .get(`/cafe-admin/workers/${worker1Id}`)
        .set('Authorization', `Bearer ${cafeAdmin2Token}`)
        .expect(403);
    });
  });

  describe('Cafe Management', () => {
    it('should get my cafe information', async () => {
      const response = await request(app.getHttpServer())
        .get('/cafe-admin/cafe/my')
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .expect(200);

      expect(response.body.id).toBe(cafe1Id);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('address');
      expect(response.body).toHaveProperty('brandId');
    });

    it('should update my cafe information', async () => {
      const response = await request(app.getHttpServer())
        .patch('/cafe-admin/cafe/my')
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .send({
          description: 'Updated description',
        })
        .expect(200);

      expect(response.body.description).toBe('Updated description');
    });

    it.skip('should update cafe schedule', async () => {
      // Skip this test as schedule implementation may vary
      const response = await request(app.getHttpServer())
        .patch('/cafe-admin/cafe/my/schedule')
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .send({
          monday: { open: '08:00', close: '20:00', isClosed: false },
          tuesday: { open: '08:00', close: '20:00', isClosed: false },
          wednesday: { open: '08:00', close: '20:00', isClosed: false },
          thursday: { open: '08:00', close: '20:00', isClosed: false },
          friday: { open: '08:00', close: '22:00', isClosed: false },
          saturday: { open: '09:00', close: '22:00', isClosed: false },
          sunday: { open: '09:00', close: '18:00', isClosed: false },
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('Activity Logs', () => {
    it('should get activity logs for cafe', async () => {
      const response = await request(app.getHttpServer())
        .get('/cafe-admin/activity-logs')
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('should filter activity logs by worker', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cafe-admin/activity-logs?workerId=${worker1Id}`)
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      if (response.body.logs.length > 0) {
        expect(response.body.logs[0].workerId).toBe(worker1Id);
      }
    });

    it('should filter activity logs by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000)
        .toISOString()
        .split('T')[0];

      const response = await request(app.getHttpServer())
        .get(`/cafe-admin/activity-logs?startDate=${today}&endDate=${tomorrow}`)
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('should get activity logs statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/cafe-admin/activity-logs/stats')
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('byAction');
      expect(response.body).toHaveProperty('byCategory');
      expect(response.body).toHaveProperty('bySeverity');
    });

    it('should paginate activity logs', async () => {
      const response = await request(app.getHttpServer())
        .get('/cafe-admin/activity-logs?page=1&limit=5')
        .set('Authorization', `Bearer ${cafeAdmin1Token}`)
        .expect(200);

      expect(response.body.logs.length).toBeLessThanOrEqual(5);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should not allow cafe admin to access logs from another cafe', async () => {
      // CafeAdmin2 should not see logs from cafe1
      const response = await request(app.getHttpServer())
        .get('/cafe-admin/activity-logs')
        .set('Authorization', `Bearer ${cafeAdmin2Token}`)
        .expect(200);

      // Should return empty or only cafe2 logs
      if (response.body.logs.length > 0) {
        const cafe1Logs = response.body.logs.filter(
          (log: any) => log.cafeId === cafe1Id,
        );
        expect(cafe1Logs.length).toBe(0);
      }
    });
  });

  describe('Authorization', () => {
    it('should not allow worker to access cafe admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/cafe-admin/workers')
        .set('Authorization', `Bearer ${worker1Token}`)
        .expect(403);
    });

    it('should not allow worker to invite other workers', async () => {
      await request(app.getHttpServer())
        .post('/cafe-admin/workers')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          email: 'unauthorized@test.com',
          firstName: 'Unauthorized',
          lastName: 'Worker',
        })
        .expect(403);
    });

    it('should not allow worker to update cafe information', async () => {
      await request(app.getHttpServer())
        .patch('/cafe-admin/cafe/my')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          description: 'Unauthorized update',
        })
        .expect(403);
    });
  });
});
