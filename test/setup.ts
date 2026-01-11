// Jest setup file for e2e tests
import { jest } from '@jest/globals';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import './types/test-globals.d';

// Increase timeout for all tests
jest.setTimeout(60000);

// Global test data cleanup
let prismaInstance: PrismaService | null = null;

// Test data IDs for singleton pattern
export const TEST_DATA_IDS = {
  // Users
  SYSTEM_ADMIN_1: 'test-system-admin-1',
  BRAND_ADMIN_1: 'test-brand-admin-1',
  CAFE_ADMIN_1: 'test-cafe-admin-1',
  WORKER_1: 'test-worker-1',
  REGULAR_USER_1: 'test-regular-user-1',
  REGULAR_USER_2: 'test-regular-user-2',

  // Brands
  BRAND_1: 'test-brand-1',
  BRAND_2: 'test-brand-2',

  // Regions
  REGION_1: 'test-region-1',
  REGION_2: 'test-region-2',

  // Cafes
  CAFE_1: 'test-cafe-1',
  CAFE_2: 'test-cafe-2',
} as const;

// Global cleanup function
export async function cleanupTestData(prisma: PrismaService) {
  try {
    // Clean up in order to respect foreign key constraints
    // Order matters due to foreign key constraints

    // Clean transactions first (references orders and users)
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

    // Clean payment cards (references users)
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

    // Clean appointments (references users and cafes)
    await prisma.appointment.deleteMany({
      where: {
        OR: [
          { user: { email: { contains: '@test.com' } } },
          { user: { email: { contains: 'test-' } } },
          { user: { email: { contains: '@example.com' } } },
          { user: { email: { contains: 'systemadmin-' } } },
          { user: { email: { contains: 'user-' } } },
          { user: { email: { contains: '-test-' } } },
          {
            cafe: {
              OR: [
                { name: { contains: 'Test' } },
                { name: { contains: 'Other Cafe' } },
                { name: { contains: 'Cafe' } },
              ],
            },
          },
        ],
      },
    });

    // Clean reviews (references users and cafes)
    await prisma.review.deleteMany({
      where: {
        OR: [
          { user: { email: { contains: '@test.com' } } },
          { user: { email: { contains: 'test-' } } },
          { user: { email: { contains: '@example.com' } } },
          { user: { email: { contains: 'systemadmin-' } } },
          { user: { email: { contains: 'user-' } } },
          { user: { email: { contains: '-test-' } } },
          {
            cafe: {
              OR: [
                { name: { contains: 'Test' } },
                { name: { contains: 'Other Cafe' } },
                { name: { contains: 'Cafe' } },
              ],
            },
          },
        ],
      },
    });

    // Clean orders (references users and cafes)
    await prisma.order.deleteMany({
      where: {
        OR: [
          { user: { email: { contains: '@test.com' } } },
          { user: { email: { contains: 'test-' } } },
          { user: { email: { contains: '@example.com' } } },
          { user: { email: { contains: 'systemadmin-' } } },
          { user: { email: { contains: 'user-' } } },
          { user: { email: { contains: '-test-' } } },
          {
            cafe: {
              OR: [
                { name: { contains: 'Test' } },
                { name: { contains: 'Other Cafe' } },
                { name: { contains: 'Cafe' } },
              ],
            },
          },
        ],
      },
    });

    // Clean brand documents (references brands)
    await prisma.brandDocument.deleteMany({
      where: {
        brand: {
          OR: [
            { name: { contains: 'Test' } },
            { name: { contains: 'Other Brand' } },
            { name: { contains: 'Minimal Brand' } },
            { name: { contains: 'Brand With' } },
            { name: { contains: 'Inactive Brand' } },
          ],
        },
      },
    });

    // Clean brand API keys (references brands)
    await prisma.brandApiKey.deleteMany({
      where: {
        brand: {
          OR: [
            { name: { contains: 'Test' } },
            { name: { contains: 'Other Brand' } },
            { name: { contains: 'Minimal Brand' } },
            { name: { contains: 'Brand With' } },
            { name: { contains: 'Inactive Brand' } },
          ],
        },
      },
    });

    // Clean cafes FIRST (references brands and regions)
    await prisma.cafe.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Test' } },
          { name: { contains: 'Other Cafe' } },
          { name: { contains: 'Cafe' } },
          { name: { contains: 'Other' } },
          { name: { contains: 'Minimal' } },
          { name: { contains: 'Sorting' } },
          { name: { contains: 'Distance' } },
          { name: { contains: 'Search' } },
          { name: { contains: 'Description' } },
          { name: { contains: 'Unique' } },
          { name: { contains: 'Pagination' } },
          { name: { contains: 'Rating' } },
          { name: { contains: 'Location' } },
          { name: { contains: 'Filter' } },
        ],
      },
    });

    // Clean brands AFTER cafes (referenced by cafes and worker accounts)
    await prisma.brand.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Test' } },
          { name: { contains: 'Other' } },
          { name: { contains: 'Minimal' } },
          { name: { contains: 'Brand' } },
          { name: { contains: 'Inactive' } },
          { name: { contains: 'Custom' } },
          { name: { contains: 'GET' } },
          { name: { contains: 'Documents' } },
          { name: { contains: 'Verification' } },
          { name: { contains: 'Activation' } },
          { name: { contains: 'Missing' } },
          { name: { contains: 'Unverified' } },
          { name: { contains: 'Verified' } },
          { name: { contains: 'Already' } },
          { name: { contains: 'Suspended' } },
          { email: { contains: '@test.com' } },
          { email: { contains: 'test-' } },
          { email: { contains: '@example.com' } },
          { email: { contains: '@brand.com' } },
          { email: { contains: 'systemadmin-' } },
          { email: { contains: 'user-' } },
          { email: { contains: '-test-' } },
        ],
      },
    });

    // Clean regions (referenced by cafes)
    await prisma.region.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Test' } },
          { name: { contains: 'Other' } },
          { name: { contains: 'Delete' } },
        ],
      },
    });

    // Clean worker accounts - hard delete to avoid foreign key issues
    await prisma.workerAccount.deleteMany({
      where: {
        OR: [
          { email: { contains: '@test.com' } },
          { email: { contains: 'test-' } },
          { email: { contains: '@example.com' } },
          { email: { contains: 'systemadmin-' } },
          { email: { contains: 'user-' } },
          { email: { contains: '-test-' } },
          { keycloakId: { contains: 'test-' } },
        ],
      },
    });

    // Clean payment cards first (before users)
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

    // Clean users - hard delete to avoid foreign key issues
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { contains: '@test.com' } },
          { email: { contains: 'test-' } },
          { email: { contains: '@example.com' } },
          { email: { contains: 'systemadmin-' } },
          { email: { contains: 'user-' } },
          { email: { contains: '-test-' } },
          { keycloakId: { contains: 'test-' } },
        ],
      },
    });
  } catch (error) {
    console.warn('Error during test data cleanup:', error);
  }
}

// Setup global cleanup before each test
beforeEach(async () => {
  if (!prismaInstance) {
    // This will be set by the test module
    return;
  }
  await cleanupTestData(prismaInstance);
});

// Setup global cleanup after each test
afterEach(async () => {
  if (!prismaInstance) {
    return;
  }
  await cleanupTestData(prismaInstance);
});

// Function to set prisma instance for global cleanup
export function setPrismaInstanceForCleanup(prisma: PrismaService) {
  prismaInstance = prisma;
}

// Global retry helper for API calls
global.testRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (i === maxRetries - 1) throw error;
      if (
        errorMessage.includes('Invalid refresh token') ||
        errorMessage.includes('Login failed') ||
        errorMessage.includes('Unauthorized')
      ) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  // This should never be reached, but TypeScript requires it
  throw new Error('Retry function failed unexpectedly');
};

// Mock console methods to reduce noise in test output
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // Filter out common Keycloak token refresh errors during tests
  const errorMessages = args.filter(
    (arg): arg is string => typeof arg === 'string',
  );
  if (errorMessages.some((msg) => msg.includes('Invalid refresh token'))) {
    return;
  }
  if (errorMessages.some((msg) => msg.includes('Login failed'))) {
    return;
  }
  originalConsoleError(...args);
};

// Global test request helper
declare global {
  var testRequest: any;
  var cleanupTestConnections: () => Promise<void>;
}

// Global helper for creating test requests
global.createTestRequest = (app: any) => {
  const server = app.getHttpServer();
  return {
    post: (url: string) => request(server).post(url),
    get: (url: string) => request(server).get(url),
    patch: (url: string) => request(server).patch(url),
    delete: (url: string) => request(server).delete(url),
  };
};

// Global cleanup function to close all connections
global.cleanupTestConnections = async () => {
  // Close any remaining HTTP servers
  try {
    // Force close any remaining handles
    const proc = process as any;
    if (proc._getActiveHandles) {
      const handles = proc._getActiveHandles();
      handles.forEach((handle: any) => {
        if (handle && typeof handle.destroy === 'function') {
          try {
            handle.destroy();
          } catch (e) {
            // Ignore errors
          }
        }
      });
    }
  } catch (e) {
    // Ignore errors
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Give some time for cleanup
  await new Promise((resolve) => setTimeout(resolve, 200));
};
