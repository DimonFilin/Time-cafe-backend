import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { KeycloakService } from '../src/modules/auth/services/keycloak.service';
import {
  createSystemAdmin,
  createBrandAdmin,
  createBrand,
} from './helpers/test-factories';
import { BrandStatus } from '@prisma/client';
import { SystemSettingsResponseDto } from '../src/modules/system-settings/dto/system-settings.dto';

describe('System Settings Endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let keycloakService: KeycloakService;

  // Helper to get test factories dependencies
  const getTestFactoriesDeps = () => ({
    app,
    prisma,
    keycloakService,
  });

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
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    keycloakService = moduleFixture.get<KeycloakService>(KeycloakService);
  });

  afterAll(async () => {
    // Clean up test data in correct order (dependencies first)
    await prisma.order.deleteMany({
      where: {
        OR: [
          { user: { email: { contains: '@test.com' } } },
          { user: { email: { contains: 'test-' } } },
          { cafe: { name: { contains: 'Test' } } },
        ],
      },
    });
    await prisma.cafe.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Test' } },
          { brand: { name: { contains: 'Test' } } },
        ],
      },
    });
    await prisma.brand.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Test' } },
          { email: { contains: '@test.com' } },
          { email: { contains: 'test-' } },
        ],
      },
    });
    await prisma.transaction.deleteMany({
      where: {
        OR: [
          { user: { email: { contains: '@test.com' } } },
          { user: { email: { contains: 'test-' } } },
          { user: { email: { contains: '@example.com' } } },
          { user: { email: { contains: 'systemadmin-' } } },
          { user: { email: { contains: 'user-' } } },
          { user: { email: { contains: '-test-' } } },
        ],
      },
    });
    await prisma.paymentCard.deleteMany({
      where: {
        OR: [
          { user: { email: { contains: '@test.com' } } },
          { user: { email: { contains: 'test-' } } },
          { user: { email: { contains: '@example.com' } } },
          { user: { email: { contains: 'systemadmin-' } } },
          { user: { email: { contains: 'user-' } } },
          { user: { email: { contains: '-test-' } } },
        ],
      },
    });
    await prisma.review.deleteMany({
      where: {
        user: {
          OR: [
            { email: { contains: '@test.com' } },
            { email: { contains: 'test-' } },
            { email: { contains: '@example.com' } },
            { email: { contains: 'systemadmin-' } },
            { email: { contains: 'user-' } },
            { email: { contains: '-test-' } },
          ],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { contains: '@test.com' } },
          { email: { contains: 'test-' } },
          { email: { contains: '@example.com' } },
          { email: { contains: 'systemadmin-' } },
          { email: { contains: 'user-' } },
          { email: { contains: '-test-' } },
        ],
      },
    });
    await prisma.workerAccount.deleteMany({
      where: {
        OR: [
          { email: { contains: '@test.com' } },
          { email: { contains: 'test-' } },
          { email: { contains: '@example.com' } },
          { email: { contains: 'systemadmin-' } },
          { email: { contains: 'user-' } },
          { email: { contains: '-test-' } },
        ],
      },
    });
    // Clean up connections
    await global.cleanupTestConnections();
    await app.close();
  });

  describe('GET /admin/settings', () => {
    beforeEach(async () => {
      // Clean up system settings before each test to ensure clean state
      try {
        await prisma.$executeRaw`DELETE FROM system_settings WHERE id = 'system'`;
      } catch {
        // Ignore if settings don't exist
      }
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/settings')
        .expect(401);
    });

    it('should return 403 for non-SYSTEM_ADMIN', async () => {
      const brand = await createBrand(getTestFactoriesDeps(), {
        status: BrandStatus.ACTIVE,
        isVerified: true,
        verifiedAt: new Date(),
      });

      const systemAdminToken = await createSystemAdmin(getTestFactoriesDeps());
      const brandAdminToken = await createBrandAdmin(
        getTestFactoriesDeps(),
        systemAdminToken,
        brand.id,
      );

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/settings')
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .expect(403);
    });

    it('should return default system settings for SYSTEM_ADMIN', async () => {
      const systemAdminToken = await createSystemAdmin(getTestFactoriesDeps());

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/settings')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      const body = response.body as SystemSettingsResponseDto;

      expect(body).toHaveProperty('platform');
      expect(body).toHaveProperty('security');
      expect(body).toHaveProperty('moderation');
      expect(body).toHaveProperty('notifications');
      expect(body).toHaveProperty('integrations');
      expect(body).toHaveProperty('limits');
      expect(body).toHaveProperty('updatedAt');

      // Check default values
      expect(body.platform.commissionPercentage).toBe(5);
      expect(body.platform.minOrderAmount).toBe(100);
      expect(body.security.accessTokenLifetimeMinutes).toBe(15);
      expect(body.security.refreshTokenLifetimeDays).toBe(30);
      expect(body.moderation.autoModerateReviews).toBe(true);
      expect(body.notifications.emailEnabled).toBe(true);
      expect(body.limits.maxFileSizeMB).toBe(10);
    });
  });

  describe('GET /admin/settings/:section', () => {
    let systemAdminToken: string;

    beforeAll(async () => {
      systemAdminToken = await createSystemAdmin(getTestFactoriesDeps());
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/settings/platform')
        .expect(401);
    });

    it('should return 403 for non-SYSTEM_ADMIN', async () => {
      const brand = await createBrand(getTestFactoriesDeps(), {
        status: BrandStatus.ACTIVE,
        isVerified: true,
        verifiedAt: new Date(),
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
        .get('/admin/settings/platform')
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .expect(403);
    });

    it('should return platform settings section', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/settings/platform')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('commissionPercentage');
      expect(response.body).toHaveProperty('minOrderAmount');
      expect(response.body).toHaveProperty('maxBrandsPerAccount');
      expect(response.body).toHaveProperty('maxCafesPerBrand');
    });

    it('should return security settings section', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/settings/security')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('accessTokenLifetimeMinutes');
      expect(response.body).toHaveProperty('refreshTokenLifetimeDays');
      expect(response.body).toHaveProperty('minPasswordLength');
      expect(response.body).toHaveProperty('requirePasswordComplexity');
    });

    it('should return 404 for invalid section', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/admin/settings/invalid')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);
    });
  });

  describe('PATCH /admin/settings', () => {
    let systemAdminToken: string;

    beforeAll(async () => {
      systemAdminToken = await createSystemAdmin(getTestFactoriesDeps());
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/admin/settings')
        .send({})
        .expect(401);
    });

    it('should return 403 for non-SYSTEM_ADMIN', async () => {
      const brand = await createBrand(getTestFactoriesDeps(), {
        status: BrandStatus.ACTIVE,
        isVerified: true,
        verifiedAt: new Date(),
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
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send({})
        .expect(403);
    });

    it('should update platform settings', async () => {
      const updateDto = {
        platform: {
          commissionPercentage: 10,
          minOrderAmount: 200,
        },
      };

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateDto)
        .expect(200);

      const body = response.body as SystemSettingsResponseDto;

      expect(body.platform.commissionPercentage).toBe(10);
      expect(body.platform.minOrderAmount).toBe(200);
      expect(body.platform.maxBrandsPerAccount).toBe(10); // Should keep default
      expect(body).toHaveProperty('updatedBy');
    });

    it('should update security settings', async () => {
      const updateDto = {
        security: {
          accessTokenLifetimeMinutes: 30,
          minPasswordLength: 12,
        },
      };

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateDto)
        .expect(200);

      const body = response.body as SystemSettingsResponseDto;

      expect(body.security.accessTokenLifetimeMinutes).toBe(30);
      expect(body.security.minPasswordLength).toBe(12);
      expect(body.security.refreshTokenLifetimeDays).toBe(30); // Should keep default
    });

    it('should update multiple sections at once', async () => {
      const updateDto = {
        platform: {
          commissionPercentage: 7.5,
        },
        moderation: {
          autoModerateReviews: false,
          documentVerificationDays: 14,
        },
        notifications: {
          emailEnabled: false,
          smsEnabled: true,
        },
      };

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateDto)
        .expect(200);

      const body = response.body as SystemSettingsResponseDto;

      expect(body.platform.commissionPercentage).toBe(7.5);
      expect(body.moderation.autoModerateReviews).toBe(false);
      expect(body.moderation.documentVerificationDays).toBe(14);
      expect(body.notifications.emailEnabled).toBe(false);
      expect(body.notifications.smsEnabled).toBe(true);
    });

    it('should validate platform settings', async () => {
      const updateDto = {
        platform: {
          commissionPercentage: 150, // Invalid: > 100
        },
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateDto)
        .expect(400);
    });

    it('should validate security settings', async () => {
      const updateDto = {
        security: {
          minPasswordLength: 3, // Invalid: < 6
        },
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateDto)
        .expect(400);
    });

    it('should validate limits settings', async () => {
      const updateDto = {
        limits: {
          maxFileSizeMB: 0, // Invalid: < 1
        },
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateDto)
        .expect(400);
    });

    it('should preserve existing settings when updating partial', async () => {
      // First, set some values
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          platform: {
            commissionPercentage: 8,
            minOrderAmount: 150,
          },
        })
        .expect(200);

      // Then update only one field
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          platform: {
            commissionPercentage: 9,
          },
        })
        .expect(200);

      const body = response.body as SystemSettingsResponseDto;

      // Should preserve minOrderAmount
      expect(body.platform.commissionPercentage).toBe(9);
      expect(body.platform.minOrderAmount).toBe(150);
    });
  });
});
