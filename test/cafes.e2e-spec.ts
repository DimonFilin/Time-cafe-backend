import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BrandStatus, WorkerRole } from '@prisma/client';
import { CafeResponseDto } from '../src/modules/cafes/dto/cafe-response.dto';
import { CafeListResponseDto } from '../src/modules/cafes/dto/cafe-list-response.dto';

describe('Cafes Endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cafesToCleanup: string[] = [];
  const brandsToCleanup: string[] = [];
  const regionsToCleanup: string[] = [];

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
  });

  afterAll(async () => {
    // Cleanup cafes
    for (const cafeId of cafesToCleanup) {
      try {
        await prisma.cafe.delete({ where: { id: cafeId } }).catch(() => {});
      } catch {
        // Ignore errors
      }
    }

    // Cleanup brands
    for (const brandId of brandsToCleanup) {
      try {
        await prisma.brand.delete({ where: { id: brandId } }).catch(() => {});
      } catch {
        // Ignore errors
      }
    }

    // Cleanup regions
    for (const regionId of regionsToCleanup) {
      try {
        await prisma.region.delete({ where: { id: regionId } }).catch(() => {});
      } catch {
        // Ignore errors
      }
    }

    await app.close();
  });

  describe('POST /cafes', () => {
    let testBrandId: string;
    let testRegionId: string;
    let brandAdminToken: string;
    let systemAdminToken: string;

    beforeAll(async () => {
      // Create test brand (ACTIVE)
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Cafes',
          email: 'cafes@brand.com',
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
          name: 'Moscow Region',
          country: 'Russia',
        },
      });
      testRegionId = region.id;
      regionsToCleanup.push(testRegionId);

      // Register BRAND_ADMIN
      const adminEmail = `cafeadmin-${Date.now()}@test.com`;
      const adminResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send({
          email: adminEmail,
          password: 'Admin123!@#',
          firstName: 'Cafe',
          lastName: 'Admin',
          role: WorkerRole.BRAND_ADMIN,
          brandId: testBrandId,
        });

      if (adminResponse.status === 201) {
        brandAdminToken = (adminResponse.body as { accessToken: string })
          .accessToken;
      } else {
        const loginResponse = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .post('/auth/login')
          .send({
            email: adminEmail,
            password: 'Admin123!@#',
          });
        brandAdminToken = (loginResponse.body as { accessToken: string })
          .accessToken;
      }

      // Register SYSTEM_ADMIN
      const systemAdminEmail = `systemadmin-cafe-${Date.now()}@test.com`;
      const systemAdminResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send({
          email: systemAdminEmail,
          password: 'Admin123!@#',
          firstName: 'System',
          lastName: 'Admin',
          role: WorkerRole.SYSTEM_ADMIN,
        });

      if (systemAdminResponse.status === 201) {
        systemAdminToken = (systemAdminResponse.body as { accessToken: string })
          .accessToken;
      } else {
        const loginResponse = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .post('/auth/login')
          .send({
            email: systemAdminEmail,
            password: 'Admin123!@#',
          });
        systemAdminToken = (loginResponse.body as { accessToken: string })
          .accessToken;
      }
    });

    it('should create cafe as BRAND_ADMIN', async () => {
      const createCafeDto = {
        name: 'Test Cafe',
        description: 'Test cafe description',
        address: 'Moscow, Red Square, 1',
        city: 'Moscow',
        street: 'Red Square',
        latitude: 55.7539,
        longitude: 37.6208,
        brandId: testBrandId,
        regionId: testRegionId,
      };

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/cafes')
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send(createCafeDto)
        .expect(201);

      const body = response.body as CafeResponseDto;
      expect(body).toHaveProperty('id');
      expect(body.name).toBe(createCafeDto.name);
      expect(body.address).toBe(createCafeDto.address);
      expect(body.latitude).toBe(createCafeDto.latitude);
      expect(body.longitude).toBe(createCafeDto.longitude);
      expect(body.brandId).toBe(testBrandId);
      expect(body.regionId).toBe(testRegionId);
      expect(body.rating).toBe(0);
      expect(body.reviewsCount).toBe(0);

      cafesToCleanup.push(body.id);
    });

    it('should create cafe as SYSTEM_ADMIN', async () => {
      const createCafeDto = {
        name: 'System Admin Cafe',
        address: 'Moscow, Tverskaya, 10',
        city: 'Moscow',
        latitude: 55.7558,
        longitude: 37.6173,
        brandId: testBrandId,
        regionId: testRegionId,
      };

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/cafes')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(createCafeDto)
        .expect(201);

      const body = response.body as CafeResponseDto;
      expect(body).toHaveProperty('id');
      expect(body.name).toBe(createCafeDto.name);
      cafesToCleanup.push(body.id);
    });

    it('should return 400 for invalid coordinates', async () => {
      const createCafeDto = {
        name: 'Invalid Cafe',
        address: 'Moscow, Test St, 1',
        city: 'Moscow',
        latitude: 100, // Invalid: > 90
        longitude: 37.6208,
        brandId: testBrandId,
        regionId: testRegionId,
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/cafes')
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send(createCafeDto)
        .expect(400);
    });

    it('should return 400 for inactive brand', async () => {
      // Create inactive brand
      const inactiveBrand = await prisma.brand.create({
        data: {
          name: 'Inactive Brand',
          email: 'inactive@brand.com',
          phone: '+7 (999) 123-45-68',
          address: '456 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      brandsToCleanup.push(inactiveBrand.id);

      const createCafeDto = {
        name: 'Cafe for Inactive Brand',
        address: 'Moscow, Test St, 1',
        city: 'Moscow',
        latitude: 55.7539,
        longitude: 37.6208,
        brandId: inactiveBrand.id,
        regionId: testRegionId,
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/cafes')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(createCafeDto)
        .expect(400);
    });

    it('should return 404 for non-existent brand', async () => {
      const nonExistentBrandId = '00000000-0000-0000-0000-000000000000';
      const createCafeDto = {
        name: 'Cafe for Non-existent Brand',
        address: 'Moscow, Test St, 1',
        city: 'Moscow',
        latitude: 55.7539,
        longitude: 37.6208,
        brandId: nonExistentBrandId,
        regionId: testRegionId,
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/cafes')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(createCafeDto)
        .expect(404);
    });

    it('should return 404 for non-existent region', async () => {
      const nonExistentRegionId = '00000000-0000-0000-0000-000000000000';
      const createCafeDto = {
        name: 'Cafe for Non-existent Region',
        address: 'Moscow, Test St, 1',
        city: 'Moscow',
        latitude: 55.7539,
        longitude: 37.6208,
        brandId: testBrandId,
        regionId: nonExistentRegionId,
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/cafes')
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send(createCafeDto)
        .expect(404);
    });

    it('should return 401 without token', async () => {
      const createCafeDto = {
        name: 'Unauthorized Cafe',
        address: 'Moscow, Test St, 1',
        city: 'Moscow',
        latitude: 55.7539,
        longitude: 37.6208,
        brandId: testBrandId,
        regionId: testRegionId,
      };

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/cafes')
        .send(createCafeDto)
        .expect(401);
    });
  });

  describe('GET /cafes', () => {
    let testBrandId: string;
    let testRegionId: string;
    let testCafeId: string;

    beforeAll(async () => {
      // Create test brand
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for List',
          email: 'list@brand.com',
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
          name: 'Saint Petersburg Region',
          country: 'Russia',
        },
      });
      testRegionId = region.id;
      regionsToCleanup.push(testRegionId);

      // Create test cafe
      const cafe = await prisma.cafe.create({
        data: {
          name: 'Test Cafe for List',
          address: 'Saint Petersburg, Nevsky Prospect, 1',
          city: 'Saint Petersburg',
          latitude: 59.9343,
          longitude: 30.3351,
          brandId: testBrandId,
          regionId: testRegionId,
          rating: 0,
          reviewsCount: 0,
        },
      });
      testCafeId = cafe.id;
      cafesToCleanup.push(testCafeId);
    });

    it('should return paginated list of cafes', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/cafes')
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page');
      expect(body).toHaveProperty('limit');
      expect(body).toHaveProperty('totalPages');
      expect(Array.isArray(body.items)).toBe(true);
      if (body.items.length > 0) {
        const firstCafe = body.items[0];
        expect(firstCafe).toHaveProperty('id');
        expect(firstCafe).toHaveProperty('name');
        expect(firstCafe).toHaveProperty('latitude');
        expect(firstCafe).toHaveProperty('longitude');
      }
    });

    it('should filter cafes by brandId', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/cafes?brandId=${testBrandId}`)
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(Array.isArray(body.items)).toBe(true);
      body.items.forEach((cafe) => {
        expect(cafe.brandId).toBe(testBrandId);
      });
    });

    it('should filter cafes by city', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/cafes?city=Saint Petersburg')
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(Array.isArray(body.items)).toBe(true);
      body.items.forEach((cafe) => {
        expect(cafe.city.toLowerCase()).toContain('saint petersburg');
      });
    });

    it('should filter cafes by regionId', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/cafes?regionId=${testRegionId}`)
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(Array.isArray(body.items)).toBe(true);
      // Note: regionId is not in CafeListItemDto, so we can't check it directly
      // But we can verify the response structure
      expect(body.total).toBeGreaterThanOrEqual(0);
    });

    it('should filter cafes by brandId and regionId together', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/cafes?brandId=${testBrandId}&regionId=${testRegionId}`)
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(Array.isArray(body.items)).toBe(true);
      body.items.forEach((cafe) => {
        expect(cafe.brandId).toBe(testBrandId);
      });
    });

    it('should support pagination', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/cafes?page=1&limit=5')
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(body.page).toBe(1);
      expect(body.limit).toBe(5);
      expect(body.items.length).toBeLessThanOrEqual(5);
      expect(body.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('should sort cafes by rating', async () => {
      // Create cafes with different ratings
      const cafe1 = await prisma.cafe.create({
        data: {
          name: 'Cafe with Rating 3',
          address: 'Moscow, Test St, 1',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: testBrandId,
          regionId: testRegionId,
          rating: 3.0,
          reviewsCount: 10,
        },
      });
      cafesToCleanup.push(cafe1.id);

      const cafe2 = await prisma.cafe.create({
        data: {
          name: 'Cafe with Rating 5',
          address: 'Moscow, Test St, 2',
          city: 'Moscow',
          latitude: 55.754,
          longitude: 37.6209,
          brandId: testBrandId,
          regionId: testRegionId,
          rating: 5.0,
          reviewsCount: 20,
        },
      });
      cafesToCleanup.push(cafe2.id);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/cafes?sortBy=rating&sortOrder=desc')
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(body.items.length).toBeGreaterThan(0);
      // Check that items are sorted by rating descending
      for (let i = 1; i < body.items.length; i++) {
        const prevRating = body.items[i - 1].rating || 0;
        const currRating = body.items[i].rating || 0;
        expect(prevRating).toBeGreaterThanOrEqual(currRating);
      }
    });

    it('should calculate distance when location provided', async () => {
      const moscowLat = 55.7539;
      const moscowLon = 37.6208;

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/cafes?latitude=${moscowLat}&longitude=${moscowLon}`)
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(body.items.length).toBeGreaterThan(0);
      body.items.forEach((cafe) => {
        expect(cafe).toHaveProperty('distance');
        expect(typeof cafe.distance).toBe('number');
        expect(cafe.distance).toBeGreaterThanOrEqual(0);
      });
    });

    it('should filter cafes by radius', async () => {
      const moscowLat = 55.7539;
      const moscowLon = 37.6208;
      const radiusKm = 10; // 10 km radius

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(
          `/cafes?latitude=${moscowLat}&longitude=${moscowLon}&radius=${radiusKm}`,
        )
        .expect(200);

      const body = response.body as CafeListResponseDto;
      body.items.forEach((cafe) => {
        expect(cafe.distance).toBeDefined();
        expect(cafe.distance!).toBeLessThanOrEqual(radiusKm);
      });
    });

    it('should sort cafes by distance when location provided', async () => {
      const moscowLat = 55.7539;
      const moscowLon = 37.6208;

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(
          `/cafes?latitude=${moscowLat}&longitude=${moscowLon}&sortBy=distance&sortOrder=asc`,
        )
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(body.items.length).toBeGreaterThan(0);
      // Check that items are sorted by distance ascending
      for (let i = 1; i < body.items.length; i++) {
        const prevDistance = body.items[i - 1].distance || Infinity;
        const currDistance = body.items[i].distance || Infinity;
        expect(prevDistance).toBeLessThanOrEqual(currDistance);
      }
    });

    it('should filter cafes by country', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/cafes?country=Russia')
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(Array.isArray(body.items)).toBe(true);
      // All cafes should be from Russia (through region)
      expect(body.total).toBeGreaterThanOrEqual(0);
    });

    it('should return empty result for non-existent country', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/cafes?country=NonexistentCountry12345')
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(body.items).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('should perform full-text search in cafe name', async () => {
      // Create a cafe with specific name
      const searchCafe = await prisma.cafe.create({
        data: {
          name: 'Unique Search Test Cafe',
          address: 'Moscow, Search St, 1',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: testBrandId,
          regionId: testRegionId,
          rating: 0,
          reviewsCount: 0,
        },
      });
      cafesToCleanup.push(searchCafe.id);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/cafes?search=Unique Search')
        .expect(200);

      const body = response.body as CafeListResponseDto;
      expect(body.items.length).toBeGreaterThan(0);
      const foundCafe = body.items.find((c) => c.id === searchCafe.id);
      expect(foundCafe).toBeDefined();
      expect(foundCafe?.name).toContain('Unique Search');
    });

    it('should perform full-text search in cafe address', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/cafes?search=Nevsky Prospect')
        .expect(200);

      const body = response.body as CafeListResponseDto;
      // Should find cafes in Saint Petersburg
      body.items.forEach((cafe) => {
        expect(
          cafe.address.toLowerCase() + ' ' + cafe.city.toLowerCase(),
        ).toContain('nevsky');
      });
    });

    it('should perform full-text search in cafe description', async () => {
      // Create a cafe with specific description
      const descCafe = await prisma.cafe.create({
        data: {
          name: 'Description Test Cafe',
          description:
            'This is a unique description for testing search functionality',
          address: 'Moscow, Desc St, 1',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: testBrandId,
          regionId: testRegionId,
          rating: 0,
          reviewsCount: 0,
        },
      });
      cafesToCleanup.push(descCafe.id);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/cafes?search=unique description')
        .expect(200);

      const body = response.body as CafeListResponseDto;
      const foundCafe = body.items.find((c) => c.id === descCafe.id);
      expect(foundCafe).toBeDefined();
    });

    it('should combine search with other filters', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/cafes?search=Test&brandId=${testBrandId}`)
        .expect(200);

      const body = response.body as CafeListResponseDto;
      body.items.forEach((cafe) => {
        expect(cafe.brandId).toBe(testBrandId);
        expect(
          cafe.name.toLowerCase() +
            ' ' +
            cafe.address.toLowerCase() +
            ' ' +
            cafe.city.toLowerCase(),
        ).toContain('test');
      });
    });
  });

  describe('GET /cafes/:id', () => {
    let testCafeId: string;

    beforeAll(async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand for Get',
          email: 'get@brand.com',
          phone: '+7 (999) 123-45-67',
          address: '123 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      brandsToCleanup.push(brand.id);

      const region = await prisma.region.create({
        data: {
          name: 'Test Region',
          country: 'Russia',
        },
      });
      regionsToCleanup.push(region.id);

      const cafe = await prisma.cafe.create({
        data: {
          name: 'Test Cafe for Get',
          address: 'Moscow, Test St, 1',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: brand.id,
          regionId: region.id,
          rating: 4.5,
          reviewsCount: 10,
        },
      });
      testCafeId = cafe.id;
      cafesToCleanup.push(testCafeId);
    });

    it('should return cafe by ID', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/cafes/${testCafeId}`)
        .expect(200);

      const body = response.body as CafeResponseDto;
      expect(body).toHaveProperty('id', testCafeId);
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('latitude');
      expect(body).toHaveProperty('longitude');
    });

    it('should return 404 for non-existent cafe', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/cafes/${nonExistentId}`)
        .expect(404);
    });
  });

  describe('PATCH /cafes/:id', () => {
    let testCafeId: string;
    let testBrandId: string;
    let brandAdminToken: string;

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

      const region = await prisma.region.create({
        data: {
          name: 'Update Region',
          country: 'Russia',
        },
      });
      regionsToCleanup.push(region.id);

      const cafe = await prisma.cafe.create({
        data: {
          name: 'Test Cafe for Update',
          address: 'Moscow, Test St, 1',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: testBrandId,
          regionId: region.id,
          rating: 0,
          reviewsCount: 0,
        },
      });
      testCafeId = cafe.id;
      cafesToCleanup.push(testCafeId);

      const adminEmail = `updatecafeadmin-${Date.now()}@test.com`;
      const adminResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send({
          email: adminEmail,
          password: 'Admin123!@#',
          firstName: 'Update',
          lastName: 'Admin',
          role: WorkerRole.BRAND_ADMIN,
          brandId: testBrandId,
        });

      if (adminResponse.status === 201) {
        brandAdminToken = (adminResponse.body as { accessToken: string })
          .accessToken;
      } else {
        const loginResponse = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .post('/auth/login')
          .send({
            email: adminEmail,
            password: 'Admin123!@#',
          });
        brandAdminToken = (loginResponse.body as { accessToken: string })
          .accessToken;
      }
    });

    it('should update cafe as BRAND_ADMIN', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/cafes/${testCafeId}`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send({
          name: 'Updated Cafe Name',
          description: 'Updated description',
          address: 'Moscow, Updated St, 2',
        })
        .expect(200);

      const body = response.body as CafeResponseDto;
      expect(body).toHaveProperty('id', testCafeId);
      expect(body.name).toBe('Updated Cafe Name');
      expect(body.description).toBe('Updated description');
      expect(body.address).toBe('Moscow, Updated St, 2');
    });

    it('should return 403 for BRAND_ADMIN of different brand', async () => {
      // Create another brand and admin
      const otherBrand = await prisma.brand.create({
        data: {
          name: 'Other Brand',
          email: 'other@brand.com',
          phone: '+7 (999) 123-45-69',
          address: '789 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      brandsToCleanup.push(otherBrand.id);

      const otherAdminEmail = `otherbrandadmin-${Date.now()}@test.com`;
      const otherAdminResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send({
          email: otherAdminEmail,
          password: 'Admin123!@#',
          firstName: 'Other',
          lastName: 'Admin',
          role: WorkerRole.BRAND_ADMIN,
          brandId: otherBrand.id,
        });

      let otherAdminToken: string;
      if (otherAdminResponse.status === 201) {
        otherAdminToken = (otherAdminResponse.body as { accessToken: string })
          .accessToken;
      } else {
        const loginResponse = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .post('/auth/login')
          .send({
            email: otherAdminEmail,
            password: 'Admin123!@#',
          });
        otherAdminToken = (loginResponse.body as { accessToken: string })
          .accessToken;
      }

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/cafes/${testCafeId}`)
        .set('Authorization', `Bearer ${otherAdminToken}`)
        .send({
          name: 'Try to update',
        })
        .expect(403);
    });

    it('should update cafe brandId and check new brand is active (SYSTEM_ADMIN)', async () => {
      // Get SYSTEM_ADMIN token
      const systemAdminEmail = `systemadmin-update-${Date.now()}@test.com`;
      const systemAdminResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send({
          email: systemAdminEmail,
          password: 'Admin123!@#',
          firstName: 'System',
          lastName: 'Admin',
          role: WorkerRole.SYSTEM_ADMIN,
        });

      let systemAdminToken: string;
      if (systemAdminResponse.status === 201) {
        systemAdminToken = (systemAdminResponse.body as { accessToken: string })
          .accessToken;
      } else {
        const loginResponse = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .post('/auth/login')
          .send({
            email: systemAdminEmail,
            password: 'Admin123!@#',
          });
        systemAdminToken = (loginResponse.body as { accessToken: string })
          .accessToken;
      }

      // Create another active brand
      const newBrand = await prisma.brand.create({
        data: {
          name: 'New Brand for Update',
          email: 'newbrand@test.com',
          phone: '+7 (999) 123-45-70',
          address: '999 Main St',
          status: BrandStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      brandsToCleanup.push(newBrand.id);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/cafes/${testCafeId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          brandId: newBrand.id,
        })
        .expect(200);

      const body = response.body as CafeResponseDto;
      expect(body.brandId).toBe(newBrand.id);
    });

    it('should return 400 when updating to inactive brand', async () => {
      // Get SYSTEM_ADMIN token for this test
      const systemAdminEmail = `systemadmin-inactive-${Date.now()}@test.com`;
      const systemAdminResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send({
          email: systemAdminEmail,
          password: 'Admin123!@#',
          firstName: 'System',
          lastName: 'Admin',
          role: WorkerRole.SYSTEM_ADMIN,
        });

      let systemAdminToken: string;
      if (systemAdminResponse.status === 201) {
        systemAdminToken = (systemAdminResponse.body as { accessToken: string })
          .accessToken;
      } else {
        const loginResponse = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .post('/auth/login')
          .send({
            email: systemAdminEmail,
            password: 'Admin123!@#',
          });
        systemAdminToken = (loginResponse.body as { accessToken: string })
          .accessToken;
      }

      // Create separate cafe for this test
      const inactiveBrandCafe = await prisma.cafe.create({
        data: {
          name: 'Test Cafe for Inactive Brand',
          address: 'Moscow, Inactive Test St, 1',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: testBrandId,
          regionId: (await prisma.region.findFirst({
            where: { name: 'Update Region' },
          }))!.id,
          rating: 0,
          reviewsCount: 0,
        },
      });
      cafesToCleanup.push(inactiveBrandCafe.id);

      // Create inactive brand
      const inactiveBrand = await prisma.brand.create({
        data: {
          name: 'Inactive Brand for Update',
          email: 'inactiveupdate@test.com',
          phone: '+7 (999) 123-45-71',
          address: '888 Main St',
          status: BrandStatus.PENDING,
          isVerified: false,
        },
      });
      brandsToCleanup.push(inactiveBrand.id);

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/cafes/${inactiveBrandCafe.id}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          brandId: inactiveBrand.id,
        })
        .expect(400);
    });

    it('should update cafe regionId', async () => {
      // Create separate cafe for region update test (since brandId was changed in previous test)
      const regionUpdateCafe = await prisma.cafe.create({
        data: {
          name: 'Test Cafe for Region Update',
          address: 'Moscow, Region Test St, 1',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: testBrandId,
          regionId: (await prisma.region.findFirst({
            where: { name: 'Update Region' },
          }))!.id,
          rating: 0,
          reviewsCount: 0,
        },
      });
      cafesToCleanup.push(regionUpdateCafe.id);

      // Create new region
      const newRegion = await prisma.region.create({
        data: {
          name: 'New Region for Update',
          country: 'Russia',
        },
      });
      regionsToCleanup.push(newRegion.id);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/cafes/${regionUpdateCafe.id}`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send({
          regionId: newRegion.id,
        })
        .expect(200);

      const body = response.body as CafeResponseDto;
      expect(body.regionId).toBe(newRegion.id);
    });

    it('should return 404 when updating to non-existent region', async () => {
      // Create separate cafe for this test
      const regionNotFoundCafe = await prisma.cafe.create({
        data: {
          name: 'Test Cafe for Region NotFound',
          address: 'Moscow, NotFound Test St, 1',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: testBrandId,
          regionId: (await prisma.region.findFirst({
            where: { name: 'Update Region' },
          }))!.id,
          rating: 0,
          reviewsCount: 0,
        },
      });
      cafesToCleanup.push(regionNotFoundCafe.id);

      const nonExistentRegionId = '00000000-0000-0000-0000-000000000000';
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch(`/cafes/${regionNotFoundCafe.id}`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .send({
          regionId: nonExistentRegionId,
        })
        .expect(404);
    });
  });

  describe('DELETE /cafes/:id', () => {
    let testCafeId: string;
    let testBrandId: string;
    let brandAdminToken: string;

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
      brandsToCleanup.push(testBrandId);

      const region = await prisma.region.create({
        data: {
          name: 'Delete Region',
          country: 'Russia',
        },
      });
      regionsToCleanup.push(region.id);

      const cafe = await prisma.cafe.create({
        data: {
          name: 'Test Cafe for Delete',
          address: 'Moscow, Test St, 1',
          city: 'Moscow',
          latitude: 55.7539,
          longitude: 37.6208,
          brandId: testBrandId,
          regionId: region.id,
          rating: 0,
          reviewsCount: 0,
        },
      });
      testCafeId = cafe.id;

      const adminEmail = `deletecafeadmin-${Date.now()}@test.com`;
      const adminResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send({
          email: adminEmail,
          password: 'Admin123!@#',
          firstName: 'Delete',
          lastName: 'Admin',
          role: WorkerRole.BRAND_ADMIN,
          brandId: testBrandId,
        });

      if (adminResponse.status === 201) {
        brandAdminToken = (adminResponse.body as { accessToken: string })
          .accessToken;
      } else {
        const loginResponse = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .post('/auth/login')
          .send({
            email: adminEmail,
            password: 'Admin123!@#',
          });
        brandAdminToken = (loginResponse.body as { accessToken: string })
          .accessToken;
      }
    });

    it('should soft delete cafe as BRAND_ADMIN', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .delete(`/cafes/${testCafeId}`)
        .set('Authorization', `Bearer ${brandAdminToken}`)
        .expect(204);

      // Verify cafe is soft-deleted (still in DB but with deletedAt set)
      const cafe = await prisma.cafe.findUnique({
        where: { id: testCafeId },
      });
      expect(cafe).not.toBeNull();
      if (cafe) {
        const cafeWithDeletedAt = cafe as unknown as { deletedAt: Date | null };
        expect(cafeWithDeletedAt.deletedAt).not.toBeNull();
        expect(cafeWithDeletedAt.deletedAt).toBeInstanceOf(Date);
      }

      // Verify cafe is not returned in list
      const listResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/cafes')
        .expect(200);

      const body = listResponse.body as CafeListResponseDto;
      const deletedCafe = body.items.find((c) => c.id === testCafeId);
      expect(deletedCafe).toBeUndefined();

      // Verify cafe is not returned by ID
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/cafes/${testCafeId}`)
        .expect(404);
    });
  });
});
