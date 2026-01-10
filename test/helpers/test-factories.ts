import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { KeycloakService } from '../../src/modules/auth/services/keycloak.service';
import { WorkerRole, BrandStatus } from '@prisma/client';
import type { ApiResponse } from '../types/test-globals';

/**
 * Test factories for creating test data in e2e tests
 */

export interface TestFactoriesDependencies {
  app: INestApplication;
  prisma: PrismaService;
  keycloakService: KeycloakService;
}

export function getTestFactoriesDeps(
  app: INestApplication,
  prisma: PrismaService,
  keycloakService: KeycloakService,
): TestFactoriesDependencies {
  return {
    app,
    prisma,
    keycloakService,
  };
}

/**
 * Creates a SYSTEM_ADMIN worker in Keycloak and database, returns access token
 */
export async function createSystemAdmin(
  deps: TestFactoriesDependencies,
): Promise<string> {
  const { app, prisma, keycloakService } = deps;
  const adminEmail = `systemadmin-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
  const password = 'Admin123!@#';

  try {
    // Create user in Keycloak
    const keycloakId = await keycloakService.createUser(adminEmail, password);

    // Create worker account in database
    await prisma.workerAccount.create({
      data: {
        keycloakId,
        email: adminEmail,
        firstName: 'System',
        lastName: 'Admin',
        role: WorkerRole.SYSTEM_ADMIN,
      },
    });

    // Login to get token

    const loginResponse = (await global.testRetry(async () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: adminEmail,
          password,
        })
        .expect(200);
    })) as ApiResponse<{ accessToken: string }>;

    return loginResponse.body.accessToken;
  } catch (error) {
    // If user creation failed, try to login (user might already exist)
    try {
      const loginResponse = (await global.testRetry(async () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: adminEmail,
            password,
          })
          .expect(200);
      })) as ApiResponse<{ accessToken: string }>;

      return loginResponse.body.accessToken;
    } catch {
      throw error; // Re-throw original error
    }
  }
}

/**
 * Creates a BRAND_ADMIN worker using SYSTEM_ADMIN token, returns access token
 */
export async function createBrandAdmin(
  deps: TestFactoriesDependencies,
  systemAdminToken: string,
  brandId: string,
): Promise<string> {
  const { app } = deps;

  const adminEmail = `brandadmin-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
  const password = 'Admin123!@#';

  const adminResponse = (await request(app.getHttpServer())
    .post('/auth/workers')
    .set('Authorization', `Bearer ${systemAdminToken}`)
    .send({
      email: adminEmail,
      password,
      firstName: 'Brand',
      lastName: 'Admin',
      role: WorkerRole.BRAND_ADMIN,
      brandId,
    })) as ApiResponse<{ accessToken: string }>;

  if (adminResponse.status === 201) {
    return adminResponse.body.accessToken;
  } else {
    // If registration failed, try to login
    const loginResponse = (await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: adminEmail,
        password,
      })) as ApiResponse<{ accessToken: string }>;

    return loginResponse.body.accessToken;
  }
}

/**
 * Creates a CAFE_ADMIN worker using SYSTEM_ADMIN or BRAND_ADMIN token, returns access token
 */
export async function createCafeAdmin(
  deps: TestFactoriesDependencies,
  adminToken: string,
  cafeId: string,
  brandId?: string,
): Promise<string> {
  const { app } = deps;

  const adminEmail = `cafeadmin-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
  const password = 'Admin123!@#';

  const adminResponse = (await request(app.getHttpServer())
    .post('/auth/workers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: adminEmail,
      password,
      firstName: 'Cafe',
      lastName: 'Admin',
      role: WorkerRole.CAFE_ADMIN,
      cafeId,
      ...(brandId && { brandId }),
    })) as ApiResponse<{ accessToken: string }>;

  if (adminResponse.status === 201) {
    return adminResponse.body.accessToken;
  } else {
    // If registration failed, try to login
    const loginResponse = (await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: adminEmail,
        password,
      })) as ApiResponse<{ accessToken: string }>;

    return loginResponse.body.accessToken;
  }
}

/**
 * Creates a WORKER using SYSTEM_ADMIN or BRAND_ADMIN token, returns access token
 */
export async function createWorker(
  deps: TestFactoriesDependencies,
  adminToken: string,
  cafeId: string,
  brandId?: string,
): Promise<string> {
  const { app } = deps;

  const workerEmail = `worker-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
  const password = 'Worker123!@#';

  const workerResponse = (await request(app.getHttpServer())
    .post('/auth/workers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: workerEmail,
      password,
      firstName: 'Test',
      lastName: 'Worker',
      role: WorkerRole.WORKER,
      cafeId,
      ...(brandId && { brandId }),
    })) as ApiResponse<{ accessToken: string }>;

  if (workerResponse.status === 201) {
    return workerResponse.body.accessToken;
  } else {
    // If registration failed, try to login
    const loginResponse = (await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: workerEmail,
        password,
      })) as ApiResponse<{ accessToken: string }>;

    return loginResponse.body.accessToken;
  }
}

/**
 * Creates a regular user through /auth/register, returns access token
 */
export async function createRegularUser(
  deps: TestFactoriesDependencies,
  options?: {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  },
): Promise<string> {
  const { app } = deps;

  const userEmail =
    options?.email ||
    `user-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
  const password = options?.password || 'User123!@#';

  const userResponse = (await global.testRetry(async () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: userEmail,
        password,
        firstName: options?.firstName || 'Regular',
        lastName: options?.lastName || 'User',
      })
      .expect(201);
  })) as ApiResponse<{ accessToken: string }>;

  return userResponse.body.accessToken;
}

/**
 * Creates a brand in database
 */
export async function createBrand(
  deps: TestFactoriesDependencies,
  options?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    status?: BrandStatus;
    isVerified?: boolean;
    verifiedAt?: Date;
  },
): Promise<{ id: string; name: string; email: string }> {
  const { prisma } = deps;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const email = options?.email || `brand-${timestamp}-${random}@test.com`;

  const brand = await prisma.brand.create({
    data: {
      name: options?.name || `Test Brand ${timestamp}`,
      email,
      phone: options?.phone || '+375 (29) 123-45-67',
      address: options?.address || '123 Main St',
      status: options?.status || BrandStatus.PENDING,
      isVerified: options?.isVerified ?? false,
      verifiedAt: options?.verifiedAt ?? null,
    },
  });

  return {
    id: brand.id,
    name: brand.name,
    email: email, // Use the email we created, not brand.email which might be null
  };
}

/**
 * Creates a region in database
 */
export async function createRegion(
  deps: TestFactoriesDependencies,
  options?: {
    name?: string;
    country?: string;
  },
): Promise<{ id: string; name: string; country: string }> {
  const { prisma } = deps;
  const timestamp = Date.now();

  const region = await prisma.region.create({
    data: {
      name: options?.name || `Test Region ${timestamp}`,
      country: options?.country || 'Russia',
    },
  });

  return {
    id: region.id,
    name: region.name,
    country: region.country,
  };
}

/**
 * Creates a cafe in database
 */
export async function createCafe(
  deps: TestFactoriesDependencies,
  options: {
    brandId: string;
    regionId: string;
    name?: string;
    address?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    description?: string;
  },
): Promise<{ id: string; name: string; address: string }> {
  const { prisma } = deps;
  const timestamp = Date.now();

  const cafe = await prisma.cafe.create({
    data: {
      name: options.name || `Test Cafe ${timestamp}`,
      address: options.address || '123 Main St',
      city: options.city || 'Moscow',
      latitude: options.latitude ?? 55.7539,
      longitude: options.longitude ?? 37.6208,
      description: options.description,
      brandId: options.brandId,
      regionId: options.regionId,
      rating: 0,
      reviewsCount: 0,
    },
  });

  return {
    id: cafe.id,
    name: cafe.name,
    address: cafe.address,
  };
}
