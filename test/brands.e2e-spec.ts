import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BrandStatus, WorkerRole } from '@prisma/client';
import { BrandResponseDto } from '../src/modules/brands/dto/brand-response.dto';
import { BrandStatsDto } from '../src/modules/brands/dto/brand-stats.dto';
import { BrandReportDto } from '../src/modules/brands/dto/brand-report.dto';
import { KeycloakService } from '../src/modules/auth/services/keycloak.service';
import {
  createSystemAdmin,
  createBrandAdmin,
  createRegularUser,
  getTestFactoriesDeps,
} from './helpers/test-factories';
import { CafeResponseDto } from '../src/modules/cafes/dto/cafe-response.dto';

describe('Brands Endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let keycloakService: KeycloakService;
  let deps: any;
  const brandsToCleanup: string[] = [];

  beforeAll(async () => {
    process.env.STORAGE_ENDPOINT =
      process.env.STORAGE_ENDPOINT || 'http://localhost:9000';
    process.env.STORAGE_ACCESS_KEY =
      process.env.STORAGE_ACCESS_KEY || 'minioadmin';
    process.env.STORAGE_SECRET_KEY =
      process.env.STORAGE_SECRET_KEY || 'minioadmin';
    process.env.STORAGE_REGION = process.env.STORAGE_REGION || 'us-east-1';
    process.env.STORAGE_USE_SSL = process.env.STORAGE_USE_SSL || 'false';

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
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    keycloakService = moduleFixture.get<KeycloakService>(KeycloakService);

    deps = { app, prisma, keycloakService };

    await app.init();
  });

  afterAll(async () => {
    if (prisma) {
      // Clean up test data in correct order (dependencies first)
      await prisma.orderItem.deleteMany({
        where: {
          order: {
            OR: [
              { user: { email: { contains: '@test.com' } } },
              { user: { email: { contains: 'test-' } } },
            ],
          },
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
      await prisma.review.deleteMany({
        where: {
          OR: [
            { user: { email: { contains: '@test.com' } } },
            { user: { email: { contains: 'test-' } } },
            { cafe: { name: { contains: 'Test' } } },
          ],
        },
      });
      await prisma.appointment.deleteMany({
        where: {
          OR: [
            { user: { email: { contains: '@test.com' } } },
            { user: { email: { contains: 'test-' } } },
            { cafe: { name: { contains: 'Test' } } },
          ],
        },
      });
      await prisma.brandDocument.deleteMany({
        where: {
          brand: {
            OR: [
              { name: { contains: 'Test' } },
              { email: { contains: '@test.com' } },
            ],
          },
        },
      });
      await prisma.brandApiKey.deleteMany({
        where: {
          brand: {
            OR: [
              { name: { contains: 'Test' } },
              { email: { contains: '@test.com' } },
            ],
          },
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
      try {
        await prisma.region.deleteMany({
          where: {
            OR: [{ name: { contains: 'Test' } }],
          },
        });
      } catch (regionError) {
        // Ignore foreign key errors - some cafes might still exist
        if (
          regionError instanceof Error &&
          !regionError.message.includes('cafes_regionId_fkey')
        ) {
          throw regionError;
        }
      }
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
    }
    // Clean up connections
    await global.cleanupTestConnections();
    await app.close();
  });

  describe('POST /brands', () => {
    let systemAdminToken: string;

    beforeEach(async () => {
      systemAdminToken = await createSystemAdmin(deps);
      systemAdminToken = await createSystemAdmin(deps);
    });

    it('should create a brand with valid data as SYSTEM_ADMIN', async () => {
      const createBrandDto = {
        name: 'Test Coffee Brand',
        email: 'test@brand.com',
        phone: '+7 (999) 123-45-67',
        address: '123 Main St, City, Country',
        description: 'Test brand description',
        website: 'https://testbrand.com',
      };

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/brands')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(createBrandDto)
        .expect(201);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id');
      expect(body.name).toBe(createBrandDto.name);
      expect(body.email).toBe(createBrandDto.email);
      expect(body.phone).toBe(createBrandDto.phone);
      expect(body.address).toBe(createBrandDto.address);
      expect(body.status).toBe(BrandStatus.PENDING);
      expect(body.isVerified).toBe(false);
      expect(body.primaryColor).toBe('#000000');
      expect(body.secondaryColor).toBe('#FFFFFF');
      expect(body.accentColor).toBe('#007BFF');
      expect(body.backgroundColor).toBe('#F8F9FA');
      expect(body.textColor).toBe('#212529');
      expect(body.fontFamily).toBe('Inter, sans-serif');

      brandsToCleanup.push(body.id);
    });

    it('should create a brand with minimal required data as SYSTEM_ADMIN', async () => {
      const createBrandDto = {
        name: 'Minimal Brand',
        email: 'minimal@brand.com',
        phone: '+7 (999) 111-22-33',
        address: '456 Test St',
      };

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/brands')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(createBrandDto)
        .expect(201);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id');
      expect(body.name).toBe(createBrandDto.name);
      expect(body.email).toBe(createBrandDto.email);
      expect(body.status).toBe(BrandStatus.PENDING);
      expect(body.isVerified).toBe(false);

      brandsToCleanup.push(body.id);
    });

    it('should return 401 for unauthenticated request', async () => {
      const createBrandDto = {
        name: 'Test Brand',
        email: 'test@brand.com',
        phone: '+7 (999) 123-45-67',
        address: '123 Main St',
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/brands')
        .send(createBrandDto)
        .expect(401);
    });

    it('should return 403 for non-SYSTEM_ADMIN user', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Admin',
          email: 'admin@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      brandsToCleanup.push(brand.id);

      const tempSystemAdminToken = await createSystemAdmin(deps);
      const brandAdminToken = await createBrandAdmin(
        deps,
        tempSystemAdminToken,
        brand.id,
      );

      const createBrandDto = {
        name: 'Test Brand',
        email: 'test@brand.com',
        phone: '+7 (999) 123-45-67',
        address: '123 Main St',
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/brands')
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send(createBrandDto)
        .expect(403);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidDto = {
        name: 'Test Brand',
        // Missing email, phone, address
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/brands')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should return 400 for invalid email format', async () => {
      const invalidDto = {
        name: 'Test Brand',
        email: 'invalid-email',
        phone: '+7 (999) 123-45-67',
        address: '123 Main St',
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/brands')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should return 400 for invalid website URL', async () => {
      const invalidDto = {
        name: 'Test Brand',
        email: 'test@brand.com',
        phone: '+7 (999) 123-45-67',
        address: '123 Main St',
        website: 'not-a-valid-url',
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/brands')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should return 400 for name too short', async () => {
      const invalidDto = {
        name: 'A',
        email: 'test@brand.com',
        phone: '+7 (999) 123-45-67',
        address: '123 Main St',
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/brands')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should return 400 for name too long', async () => {
      const invalidDto = {
        name: 'A'.repeat(101),
        email: 'test@brand.com',
        phone: '+7 (999) 123-45-67',
        address: '123 Main St',
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/brands')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should set default settings when creating brand', async () => {
      const createBrandDto = {
        name: 'Brand With Settings',
        email: 'settings@brand.com',
        phone: '+7 (999) 123-45-67',
        address: '123 Main St',
      };

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/brands')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(createBrandDto)
        .expect(201);

      const body = response.body as BrandResponseDto;
      expect(body.settings).toBeDefined();
      expect(body.settings).toHaveProperty('theme');
      expect(body.settings).toHaveProperty('features');
      expect(body.settings).toHaveProperty('notifications');

      brandsToCleanup.push(body.id);
    });

    it('should merge custom settings with defaults', async () => {
      const createBrandDto = {
        name: 'Brand With Custom Settings',
        email: 'custom@brand.com',
        phone: '+7 (999) 123-45-67',
        address: '123 Main St',
        settings: {
          theme: {
            mode: 'dark',
          },
          customField: 'customValue',
        },
      };

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/brands')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(createBrandDto)
        .expect(201);

      const body = response.body as BrandResponseDto;
      expect(body.settings).toBeDefined();
      if (body.settings) {
        expect(body.settings).toHaveProperty('theme');
        expect(
          (body.settings as { theme?: { mode?: string } }).theme?.mode,
        ).toBe('dark');
        expect(body.settings).toHaveProperty('features');
        expect(body.settings).toHaveProperty('customField', 'customValue');
      }

      brandsToCleanup.push(body.id);
    });
  });

  describe('GET /brands', () => {
    it('should return list of brands', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/brands')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter brands by status', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/brands')
        .query({ status: BrandStatus.PENDING })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (Array.isArray(response.body) && response.body.length > 0) {
        for (const brand of response.body as Array<{ status: BrandStatus }>) {
          expect(brand.status).toBe(BrandStatus.PENDING);
        }
      }
    });
  });

  describe('GET /brands/:id', () => {
    let testBrandId: string;

    beforeAll(async () => {
      // Create a test brand
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for GET',
          email: 'get@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);
    });

    it('should return brand by ID', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/brands/${testBrandId}`)
        .expect(200);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id', testBrandId);
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('email');
    });

    it('should return 404 for non-existent brand', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/brands/${nonExistentId}`)
        .expect(404);
    });
  });

  describe('POST /brands/:id/documents', () => {
    let testBrandId: string;
    let brandAdminToken: string;

    beforeAll(async () => {
      const deps = getTestFactoriesDeps(app, prisma, keycloakService);

      // Create system admin first
      const systemAdminToken = await createSystemAdmin(deps);

      // Create a test brand
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Documents',
          email: 'docs@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      // Create brand admin for this brand
      brandAdminToken = await createBrandAdmin(
        deps,
        systemAdminToken,
        testBrandId,
      );
    });

    it('should upload a document for brand', async () => {
      const testFile = Buffer.from('test PDF content');
      const fileName = 'test-document.pdf';

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/documents`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .field('type', 'REGISTRATION')
        .field('name', 'Test Registration Document')
        .attach('file', testFile, fileName)
        .expect(201);

      const body = response.body as {
        id: string;
        type: string;
        name: string;
        fileUrl: string;
        isVerified: boolean;
      };

      expect(body).toHaveProperty('id');
      expect(body.type).toBe('REGISTRATION');
      expect(body.name).toBe('Test Registration Document');
      expect(body.fileUrl).toBeTruthy();
      expect(body.isVerified).toBe(false);
    });

    it('should return 400 for missing file', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/documents`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .field('type', 'REGISTRATION')
        .field('name', 'Test Document')
        .expect(400);
    });

    it('should return 400 for invalid document type', async () => {
      const testFile = Buffer.from('test content');

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/documents`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .field('type', 'INVALID_TYPE')
        .field('name', 'Test Document')
        .attach('file', testFile, 'test.pdf')
        .expect(400);
    });

    it('should return 404 for non-existent brand', async () => {
      const testFile = Buffer.from('test content');
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${nonExistentId}/documents`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .field('type', 'REGISTRATION')
        .field('name', 'Test Document')
        .attach('file', testFile, 'test.pdf')
        .expect(404);
    });

    it('should return 401 without token', async () => {
      const testFile = Buffer.from('test content');

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/documents`)
        .field('type', 'REGISTRATION')
        .field('name', 'Test Document')
        .attach('file', testFile, 'test.pdf')
        .expect(401);
    });
  });

  describe('GET /brands/:id/documents', () => {
    let testBrandId: string;

    beforeAll(async () => {
      // Create a test brand
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Documents List',
          email: 'docslist@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      // Create a test document
      await prisma.brandDocument.create({
        data: {
          brandId: testBrandId,
          type: 'REGISTRATION',
          name: 'Test Document',
          fileUrl: 'http://localhost:9000/brands/test/document.pdf',
          isVerified: false,
        },
      });
    });

    it('should return list of documents for brand', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/brands/${testBrandId}/documents`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (Array.isArray(response.body) && response.body.length > 0) {
        const firstDoc = response.body[0] as { id: string; brandId: string };
        expect(firstDoc).toHaveProperty('id');
      }
    });

    it('should return 404 for non-existent brand', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/brands/${nonExistentId}/documents`)
        .expect(404);
    });
  });

  describe('GET /brands/:id/documents/:docId', () => {
    let testBrandId: string;
    let testDocumentId: string;

    beforeAll(async () => {
      // Create a test brand
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Document GET',
          email: 'docget@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      // Create a test document
      const document = await prisma.brandDocument.create({
        data: {
          brandId: testBrandId,
          type: 'LICENSE',
          name: 'Test License Document',
          fileUrl: 'http://localhost:9000/brands/test/license.pdf',
          isVerified: false,
        },
      });
      testDocumentId = document.id;
    });

    it('should return document by ID', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/brands/${testBrandId}/documents/${testDocumentId}`)
        .expect(200);

      const body = response.body as { id: string; type: string; name: string };
      expect(body).toHaveProperty('id', testDocumentId);
      expect(body).toHaveProperty('type', 'LICENSE');
      expect(body).toHaveProperty('name', 'Test License Document');
    });

    it('should return 404 for non-existent document', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/brands/${testBrandId}/documents/${nonExistentId}`)
        .expect(404);
    });
  });

  describe('PATCH /brands/:id/documents/:docId/verify', () => {
    let testBrandId: string;
    let testDocumentId: string;
    let systemAdminToken: string;
    let regularUserToken: string;

    beforeAll(async () => {
      // Create a test brand
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Verification',
          email: 'verify@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      // Create a test document
      const document = await prisma.brandDocument.create({
        data: {
          brandId: testBrandId,
          type: 'REGISTRATION',
          name: 'Test Registration Document',
          fileUrl: 'http://localhost:9000/brands/test/document.pdf',
          isVerified: false,
        },
      });
      testDocumentId = document.id;

      // Create SYSTEM_ADMIN worker
      systemAdminToken = await createSystemAdmin(deps);
      systemAdminToken = await createSystemAdmin(deps);

      // Register regular user (not SYSTEM_ADMIN)
      regularUserToken = await createRegularUser(deps);
    });

    it('should verify document as SYSTEM_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}/documents/${testDocumentId}/verify`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          verificationNote: 'Document verified successfully',
        })
        .expect(200);

      const body = response.body as {
        id: string;
        isVerified: boolean;
        verifiedAt: string;
        verifiedBy: string;
        verificationNote: string;
      };

      expect(body).toHaveProperty('id', testDocumentId);
      expect(body.isVerified).toBe(true);
      expect(body.verifiedAt).toBeTruthy();
      expect(body.verifiedBy).toBeTruthy();
      expect(body.verificationNote).toBe('Document verified successfully');
    });

    it('should return 400 when trying to verify already verified document', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}/documents/${testDocumentId}/verify`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          verificationNote: 'Try to verify again',
        })
        .expect(400);
    });

    it('should return 403 for non-SYSTEM_ADMIN user', async () => {
      // Create another unverified document
      const document = await prisma.brandDocument.create({
        data: {
          brandId: testBrandId,
          type: 'LICENSE',
          name: 'Test License Document',
          fileUrl: 'http://localhost:9000/brands/test/license.pdf',
          isVerified: false,
        },
      });

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}/documents/${document.id}/verify`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          verificationNote: 'Try to verify as regular user',
        })
        .expect(403);
    });

    it('should return 404 for non-existent document', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}/documents/${nonExistentId}/verify`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          verificationNote: 'Test',
        })
        .expect(404);
    });

    it('should return 401 without token', async () => {
      const document = await prisma.brandDocument.create({
        data: {
          brandId: testBrandId,
          type: 'CONTRACT',
          name: 'Test Contract Document',
          fileUrl: 'http://localhost:9000/brands/test/contract.pdf',
          isVerified: false,
        },
      });

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}/documents/${document.id}/verify`)
        .send({
          verificationNote: 'Test',
        })
        .expect(401);
    });
  });

  describe('POST /brands/:id/verify', () => {
    let testBrandId: string;
    let systemAdminToken: string;
    let regularUserToken: string;

    beforeAll(async () => {
      // Create SYSTEM_ADMIN worker
      systemAdminToken = await createSystemAdmin(deps);
      systemAdminToken = await createSystemAdmin(deps);

      // Register regular user
      regularUserToken = await createRegularUser(deps);
    });

    it('should verify and activate brand when all required documents are verified', async () => {
      // Create brand
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Activation',
          email: 'activate@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      // Create and verify all required documents
      await prisma.brandDocument.create({
        data: {
          brandId: testBrandId,
          type: 'REGISTRATION',
          name: 'Registration Certificate',
          fileUrl: 'http://localhost:9000/brands/test/registration.pdf',
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      await prisma.brandDocument.create({
        data: {
          brandId: testBrandId,
          type: 'LICENSE',
          name: 'License Document',
          fileUrl: 'http://localhost:9000/brands/test/license.pdf',
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      await prisma.brandDocument.create({
        data: {
          brandId: testBrandId,
          type: 'CONTRACT',
          name: 'Contract Document',
          fileUrl: 'http://localhost:9000/brands/test/contract.pdf',
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      // Activate brand
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/verify`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(201);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id', testBrandId);
      expect(body.status).toBe(BrandStatus.ACTIVE);
      expect(body.isVerified).toBe(true);
      expect(body.verifiedAt).toBeTruthy();
    });

    it('should return 400 when required documents are missing', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand Missing Docs',
          email: 'missing@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      brandsToCleanup.push(brand.id);

      // Create only REGISTRATION document (missing LICENSE and CONTRACT)
      await prisma.brandDocument.create({
        data: {
          brandId: brand.id,
          type: 'REGISTRATION',
          name: 'Registration Certificate',
          fileUrl: 'http://localhost:9000/brands/test/registration.pdf',
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${brand.id}/verify`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(400);
    });

    it('should return 400 when required documents are not verified', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand Unverified Docs',
          email: 'unverified@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      brandsToCleanup.push(brand.id);

      // Create all required documents but don't verify CONTRACT
      await prisma.brandDocument.create({
        data: {
          brandId: brand.id,
          type: 'REGISTRATION',
          name: 'Registration Certificate',
          fileUrl: 'http://localhost:9000/brands/test/registration.pdf',
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      await prisma.brandDocument.create({
        data: {
          brandId: brand.id,
          type: 'LICENSE',
          name: 'License Document',
          fileUrl: 'http://localhost:9000/brands/test/license.pdf',
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      await prisma.brandDocument.create({
        data: {
          brandId: brand.id,
          type: 'CONTRACT',
          name: 'Contract Document',
          fileUrl: 'http://localhost:9000/brands/test/contract.pdf',
          isVerified: false, // Not verified
        },
      });

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${brand.id}/verify`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(400);
    });

    it('should return 400 when brand is already verified', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand Already Verified',
          email: 'already@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      brandsToCleanup.push(brand.id);

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${brand.id}/verify`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(400);
    });

    it('should return 403 for non-SYSTEM_ADMIN user', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand For Regular User',
          email: 'regular@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      brandsToCleanup.push(brand.id);

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${brand.id}/verify`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent brand', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${nonExistentId}/verify`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);
    });

    it('should return 401 without token', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand No Token',
          email: 'notoken@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      brandsToCleanup.push(brand.id);

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${brand.id}/verify`)
        .expect(401);
    });
  });

  describe('PATCH /brands/:id/customization', () => {
    let testBrandId: string;
    let brandAdminToken: string;
    let otherBrandAdminToken: string;
    let systemAdminToken: string;
    let regularUserToken: string;

    beforeAll(async () => {
      // Create test brand
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Customization',
          email: 'custom@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      // Create another brand
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
      brandsToCleanup.push(otherBrand.id);

      // Create SYSTEM_ADMIN first
      systemAdminToken = await createSystemAdmin(deps);
      systemAdminToken = await createSystemAdmin(deps);

      // Register BRAND_ADMIN for test brand using SYSTEM_ADMIN token
      brandAdminToken = await createBrandAdmin(
        deps,
        systemAdminToken,
        testBrandId,
      );

      // Register BRAND_ADMIN for other brand using SYSTEM_ADMIN token
      otherBrandAdminToken = await createBrandAdmin(
        deps,
        systemAdminToken,
        otherBrand.id,
      );

      // Register regular user
      regularUserToken = await createRegularUser(deps);
    });

    it('should update brand customization as BRAND_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}/customization`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send({
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          accentColor: '#0000FF',
          backgroundColor: '#FFFFFF',
          textColor: '#000000',
          fontFamily: 'Arial, sans-serif',
        })
        .expect(200);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id', testBrandId);
      expect(body.primaryColor).toBe('#FF0000');
      expect(body.secondaryColor).toBe('#00FF00');
      expect(body.accentColor).toBe('#0000FF');
      expect(body.backgroundColor).toBe('#FFFFFF');
      expect(body.textColor).toBe('#000000');
      expect(body.fontFamily).toBe('Arial, sans-serif');
    });

    it('should return 400 for invalid hex color', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}/customization`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send({
          primaryColor: 'invalid-color',
        })
        .expect(400);
    });

    it('should return 403 for BRAND_ADMIN of different brand', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}/customization`)
        .set('Authorization', `Bearer ${otherBrandAdminToken}`)
        .send({
          primaryColor: '#FF0000',
        })
        .expect(403);
    });

    it('should update brand customization as SYSTEM_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}/customization`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          primaryColor: '#AA0000',
          secondaryColor: '#00AA00',
          accentColor: '#0000AA',
          backgroundColor: '#F0F0F0',
          textColor: '#333333',
          fontFamily: 'Roboto, sans-serif',
        })
        .expect(200);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id', testBrandId);
      expect(body.primaryColor).toBe('#AA0000');
      expect(body.secondaryColor).toBe('#00AA00');
      expect(body.accentColor).toBe('#0000AA');
      expect(body.backgroundColor).toBe('#F0F0F0');
      expect(body.textColor).toBe('#333333');
      expect(body.fontFamily).toBe('Roboto, sans-serif');
    });

    it('should return 403 for regular user', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}/customization`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          primaryColor: '#FF0000',
        })
        .expect(403);
    });

    it('should return 404 for non-existent brand', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${nonExistentId}/customization`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send({
          primaryColor: '#FF0000',
        })
        .expect(404);
    });
  });

  describe('POST /brands/:id/logo', () => {
    let testBrandId: string;
    let brandAdminToken: string;

    beforeAll(async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Logo',
          email: 'logo@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      const tempSystemAdminToken = await createSystemAdmin(deps);
      brandAdminToken = await createBrandAdmin(
        deps,
        tempSystemAdminToken,
        testBrandId,
      );
    });

    it('should upload logo as BRAND_ADMIN', async () => {
      const testFile = Buffer.from('fake image content');
      const fileName = 'logo.png';

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/logo`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .attach('file', testFile, fileName)
        .expect(201);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id', testBrandId);
      expect(body.logo).toBeTruthy();
    });

    it('should return 400 for missing file', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/logo`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .expect(400);
    });
  });

  describe('POST /brands/:id/banner', () => {
    let testBrandId: string;
    let brandAdminToken: string;

    beforeAll(async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Banner',
          email: 'banner@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      const tempSystemAdminToken = await createSystemAdmin(deps);
      brandAdminToken = await createBrandAdmin(
        deps,
        tempSystemAdminToken,
        testBrandId,
      );
    });

    it('should upload banner as BRAND_ADMIN', async () => {
      const testFile = Buffer.from('fake banner image content');
      const fileName = 'banner.jpg';

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/banner`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .attach('file', testFile, fileName)
        .expect(201);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id', testBrandId);
      expect(body.bannerImage).toBeTruthy();
    });

    it('should return 400 for missing file', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/banner`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .expect(400);
    });
  });

  describe('POST /brands/:id/api-keys', () => {
    let testBrandId: string;
    let brandAdminToken: string;

    beforeAll(async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for API Keys',
          email: 'apikeys@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      const tempSystemAdminToken = await createSystemAdmin(deps);
      brandAdminToken = await createBrandAdmin(
        deps,
        tempSystemAdminToken,
        testBrandId,
      );
    });

    it('should create API key as BRAND_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/api-keys`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send({
          name: 'Test API Key',
          permissions: ['brands:create', 'brands:read'],
        })
        .expect(201);

      const body = response.body as {
        id: string;
        name: string;
        key: string;
        prefix: string;
        permissions: string[];
      };

      expect(body).toHaveProperty('id');
      expect(body.name).toBe('Test API Key');
      expect(body.key).toBeTruthy();
      expect(body.key).toMatch(/^tc_live_/);
      expect(body.prefix).toBeTruthy();
      expect(body.permissions).toEqual(['brands:create', 'brands:read']);
    });

    it('should return 400 for missing permissions', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/api-keys`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send({
          name: 'Test API Key',
          permissions: [],
        })
        .expect(400);
    });
  });

  describe('GET /brands/:id/api-keys', () => {
    let testBrandId: string;
    let brandAdminToken: string;

    beforeAll(async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for API Keys List',
          email: 'apikeyslist@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      const tempSystemAdminToken = await createSystemAdmin(deps);
      brandAdminToken = await createBrandAdmin(
        deps,
        tempSystemAdminToken,
        testBrandId,
      );

      // Create test API key
      await prisma.brandApiKey.create({
        data: {
          brandId: testBrandId,
          name: 'Test API Key',
          keyHash: 'test_hash_' + Date.now(),
          prefix: 'tc_live_',
          permissions: ['brands:read'],
          isActive: true,
        },
      });
    });

    it('should return list of API keys', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/brands/${testBrandId}/api-keys`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (Array.isArray(response.body) && response.body.length > 0) {
        const firstKey = response.body[0] as { id: string; name: string };
        expect(firstKey).toHaveProperty('id');
        expect(firstKey).toHaveProperty('name');
        expect(firstKey).not.toHaveProperty('key'); // Full key should not be returned
      }
    });
  });

  describe('PATCH /brands/:id/api-keys/:keyId', () => {
    let testBrandId: string;
    let brandAdminToken: string;
    let apiKeyId: string;

    beforeAll(async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for API Key Update',
          email: 'apikeyupdate@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      const tempSystemAdminToken = await createSystemAdmin(deps);
      brandAdminToken = await createBrandAdmin(
        deps,
        tempSystemAdminToken,
        testBrandId,
      );

      const apiKey = await prisma.brandApiKey.create({
        data: {
          brandId: testBrandId,
          name: 'Test API Key',
          keyHash: 'test_hash_update_' + Date.now(),
          prefix: 'tc_live_',
          permissions: ['brands:read'],
          isActive: true,
        },
      });
      apiKeyId = apiKey.id;
    });

    it('should update API key', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send({
          name: 'Updated API Key',
          permissions: ['brands:read', 'brands:update'],
          isActive: false,
        })
        .expect(200);

      const body = response.body as {
        id: string;
        name: string;
        permissions: string[];
        isActive: boolean;
      };

      expect(body).toHaveProperty('id', apiKeyId);
      expect(body.name).toBe('Updated API Key');
      expect(body.permissions).toEqual(['brands:read', 'brands:update']);
      expect(body.isActive).toBe(false);
    });
  });

  describe('DELETE /brands/:id/api-keys/:keyId', () => {
    let testBrandId: string;
    let brandAdminToken: string;
    let apiKeyId: string;

    beforeAll(async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for API Key Delete',
          email: 'apikeydelete@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      const tempSystemAdminToken = await createSystemAdmin(deps);
      brandAdminToken = await createBrandAdmin(
        deps,
        tempSystemAdminToken,
        testBrandId,
      );

      const apiKey = await prisma.brandApiKey.create({
        data: {
          brandId: testBrandId,
          name: 'Test API Key to Delete',
          keyHash: 'test_hash_delete_' + Date.now(),
          prefix: 'tc_live_',
          permissions: ['brands:read'],
          isActive: true,
        },
      });
      apiKeyId = apiKey.id;
    });

    it('should revoke API key', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .delete(`/brands/${testBrandId}/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .expect(204);

      // Verify key is revoked
      const apiKey = await prisma.brandApiKey.findUnique({
        where: { id: apiKeyId },
      });
      expect(apiKey?.isActive).toBe(false);
      expect(apiKey?.deletedAt).toBeTruthy();
    });
  });

  describe('PATCH /brands/:id', () => {
    let testBrandId: string;
    let brandAdminToken: string;
    let systemAdminToken: string;
    let otherBrandAdminToken: string;

    beforeAll(async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Update',
          email: 'update@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      const otherBrand = await prisma.brand.create({
        data: {
          name: 'Other Brand for Update',
          email: 'otherupdate@brand.com',
          phone: '+7 (999) 123-45-68',
          address: '456 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      brandsToCleanup.push(otherBrand.id);

      systemAdminToken = await createSystemAdmin(deps);
      systemAdminToken = await createSystemAdmin(deps);
      brandAdminToken = await createBrandAdmin(
        deps,
        systemAdminToken,
        testBrandId,
      );
      otherBrandAdminToken = await createBrandAdmin(
        deps,
        systemAdminToken,
        otherBrand.id,
      );
    });

    it('should update brand as BRAND_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send({
          name: 'Updated Brand Name',
          description: 'Updated description',
          website: 'https://updated.com',
        })
        .expect(200);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id', testBrandId);
      expect(body.name).toBe('Updated Brand Name');
      expect(body.description).toBe('Updated description');
      expect(body.website).toBe('https://updated.com');
    });

    it('should update brand as SYSTEM_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          name: 'Updated by System Admin',
          description: 'Updated by system admin',
        })
        .expect(200);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id', testBrandId);
      expect(body.name).toBe('Updated by System Admin');
      expect(body.description).toBe('Updated by system admin');
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}`)
        .send({
          name: 'Updated Brand Name',
        })
        .expect(401);
    });

    it('should return 403 for BRAND_ADMIN of different brand', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/brands/${testBrandId}`)
        .set('Authorization', `Bearer ${otherBrandAdminToken}`)
        .send({
          name: 'Updated Brand Name',
        })
        .expect(403);
    });
  });

  describe('DELETE /brands/:id', () => {
    let testBrandId: string;
    let systemAdminToken: string;

    beforeAll(async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Delete',
          email: 'delete@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;

      systemAdminToken = await createSystemAdmin(deps);
      systemAdminToken = await createSystemAdmin(deps);
    });

    it('should soft delete brand as SYSTEM_ADMIN', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .delete(`/brands/${testBrandId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(204);

      // Verify brand is soft deleted
      const brand = await prisma.brand.findUnique({
        where: { id: testBrandId },
      });
      expect(brand?.deletedAt).toBeTruthy();
    });
  });

  describe('POST /brands/:id/reject', () => {
    let testBrandId: string;
    let systemAdminToken: string;

    beforeAll(async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Reject',
          email: 'reject@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      systemAdminToken = await createSystemAdmin(deps);
      systemAdminToken = await createSystemAdmin(deps);
    });

    it('should reject brand as SYSTEM_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/reject`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          reason: 'Documents do not match requirements',
        })
        .expect(201);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id', testBrandId);
      expect(body.status).toBe(BrandStatus.REJECTED);
      expect(body.isVerified).toBe(false);
    });

    it('should return 400 when brand is already rejected', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/reject`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          reason: 'Try to reject again',
        })
        .expect(400);
    });
  });

  describe('POST /brands/:id/suspend', () => {
    let testBrandId: string;
    let systemAdminToken: string;

    beforeAll(async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Suspend',
          email: 'suspend@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      systemAdminToken = await createSystemAdmin(deps);
      systemAdminToken = await createSystemAdmin(deps);
    });

    it('should suspend brand as SYSTEM_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/suspend`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          reason: 'Violation of terms of service',
        })
        .expect(201);

      const body = response.body as BrandResponseDto;
      expect(body).toHaveProperty('id', testBrandId);
      expect(body.status).toBe(BrandStatus.SUSPENDED);
    });

    it('should return 400 when brand is already suspended', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/brands/${testBrandId}/suspend`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          reason: 'Try to suspend again',
        })
        .expect(400);
    });
  });

  describe('BRAND_ADMIN endpoints', () => {
    let testBrandId: string;
    let brandAdminToken: string;
    let systemAdminToken: string;
    const testCafeIds: string[] = [];
    let testRegionId: string;

    beforeAll(async () => {
      systemAdminToken = await createSystemAdmin(deps);
      systemAdminToken = await createSystemAdmin(deps);

      // Create test brand
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Admin',
          email: 'admin@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      testBrandId = brand.id;
      brandsToCleanup.push(testBrandId);

      // Create test region
      const region = await prisma.region.create({
        data: {
          name: 'Test Region',
          country: 'Russia',
        },
      });
      testRegionId = region.id;

      // Create test cafes
      const cafe1 = await prisma.cafe.create({
        data: {
          name: 'Cafe 1',
          address: 'Moscow, Test St, 1',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: testBrandId,
          regionId: testRegionId,
          rating: 4.5,
          reviewsCount: 10,
        },
      });
      testCafeIds.push(cafe1.id);

      const cafe2 = await prisma.cafe.create({
        data: {
          name: 'Cafe 2',
          address: 'Saint Petersburg, Test St, 2',
          city: 'Saint Petersburg',
          latitude: 59.9343,
          longitude: 30.3351,
          brandId: testBrandId,
          regionId: testRegionId,
          rating: 4.0,
          reviewsCount: 5,
        },
      });
      testCafeIds.push(cafe2.id);

      // Create BRAND_ADMIN
      brandAdminToken = await createBrandAdmin(
        deps,
        systemAdminToken,
        testBrandId,
      );
    });

    describe('GET /brands/my/cafes', () => {
      it('should return cafes for BRAND_ADMIN', async () => {
        const response = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/cafes')
          .set('Authorization', `Bearer ${brandAdminToken}`)
          .expect(200);

        const body = response.body as CafeResponseDto[];
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBeGreaterThanOrEqual(2);
        body.forEach((cafe) => {
          expect(cafe.brandId).toBe(testBrandId);
        });
      });

      it('should return 403 for non-BRAND_ADMIN', async () => {
        const userToken = await createRegularUser(deps);

        await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/cafes')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });

      it('should return 401 for unauthenticated request', async () => {
        await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/cafes')
          .expect(401);
      });
    });

    describe('GET /brands/my/stats', () => {
      it('should return brand statistics for BRAND_ADMIN', async () => {
        const response = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/stats')
          .set('Authorization', `Bearer ${brandAdminToken}`)
          .expect(200);

        const body = response.body as BrandStatsDto;
        expect(body).toHaveProperty('totalCafes');
        expect(body).toHaveProperty('activeCafes');
        expect(body).toHaveProperty('averageRating');
        expect(body).toHaveProperty('totalReviews');
        expect(body).toHaveProperty('cafesByCity');
        expect(body).toHaveProperty('cafesByRegion');
        expect(body.totalCafes).toBeGreaterThanOrEqual(2);
        expect(body.averageRating).toBeGreaterThanOrEqual(0);
        expect(body.totalReviews).toBeGreaterThanOrEqual(15);
      });

      it('should return 403 for non-BRAND_ADMIN', async () => {
        const userToken = await createRegularUser(deps);

        await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/stats')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('GET /brands/my/reports', () => {
      it('should return brand report for BRAND_ADMIN', async () => {
        const response = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/reports')
          .set('Authorization', `Bearer ${brandAdminToken}`)
          .expect(200);

        const body = response.body as BrandReportDto;
        expect(body).toHaveProperty('brand');
        expect(body).toHaveProperty('statistics');
        expect(body).toHaveProperty('cafes');
        expect(body).toHaveProperty('generatedAt');
        expect(body.brand.id).toBe(testBrandId);
        expect(body.statistics.totalCafes).toBeGreaterThanOrEqual(2);
        expect(Array.isArray(body.cafes)).toBe(true);
        expect(body.cafes.length).toBeGreaterThanOrEqual(2);
      });

      it('should return 403 for non-BRAND_ADMIN', async () => {
        const userToken = await createRegularUser(deps);

        await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/reports')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('GET /brands/my/reports/export/:format', () => {
      it('should export report as Excel', async () => {
        const response = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/reports/export/excel')
          .set('Authorization', `Bearer ${brandAdminToken}`)
          .expect(200)
          .expect(
            'Content-Type',
            /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
          );

        expect(response.headers['content-disposition']).toContain('.xlsx');
        expect(response.headers['content-length']).toBeDefined();
        expect(
          parseInt(response.headers['content-length'] || '0'),
        ).toBeGreaterThan(0);
      });

      it('should export report as PDF', async () => {
        const response = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/reports/export/pdf')
          .set('Authorization', `Bearer ${brandAdminToken}`)
          .expect(200);

        expect(response.headers['content-type']).toContain('application/pdf');
        expect(response.headers['content-disposition']).toContain('.pdf');
        expect(Buffer.isBuffer(response.body)).toBe(true);
        if (Buffer.isBuffer(response.body)) {
          expect(response.body.length).toBeGreaterThan(0);
        }
      });

      it('should export report as DOCX', async () => {
        const response = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/reports/export/docx')
          .set('Authorization', `Bearer ${brandAdminToken}`)
          .expect(200)
          .expect(
            'Content-Type',
            /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/,
          );

        expect(response.headers['content-disposition']).toContain('.docx');
        expect(response.headers['content-length']).toBeDefined();
        expect(
          parseInt(response.headers['content-length'] || '0'),
        ).toBeGreaterThan(0);
      });

      it('should export report as CSV', async () => {
        const response = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/reports/export/csv')
          .set('Authorization', `Bearer ${brandAdminToken}`)
          .expect(200)
          .expect('Content-Type', /text\/csv/);

        expect(response.headers['content-disposition']).toContain('.csv');
        expect(response.headers['content-length']).toBeDefined();
        const contentLengthStr = response.headers['content-length'];
        const contentLength =
          typeof contentLengthStr === 'string'
            ? parseInt(contentLengthStr, 10)
            : 0;
        expect(contentLength).toBeGreaterThan(0);

        // For CSV, we can check text content
        if (response.text) {
          expect(response.text).toContain('Name,Address,City,Rating,Reviews');
          expect(response.text).toContain('Cafe 1');
          expect(response.text).toContain('Cafe 2');
        }
      });

      it('should return 400 for invalid format', async () => {
        await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/reports/export/invalid')
          .set('Authorization', `Bearer ${brandAdminToken}`)
          .expect(400);
      });

      it('should return 403 for non-BRAND_ADMIN', async () => {
        const userToken = await createRegularUser(deps);

        await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/reports/export/excel')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });

      it('should return 401 for unauthenticated request', async () => {
        await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .get('/brands/my/reports/export/excel')
          .expect(401);
      });
    });
  });
});
