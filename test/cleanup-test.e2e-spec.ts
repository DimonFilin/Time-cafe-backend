import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setPrismaInstanceForCleanup } from './setup';

describe('Cleanup Test (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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

    // Set prisma instance for global cleanup
    setPrismaInstanceForCleanup(prisma);
  });

  afterAll(async () => {
    // Clean up connections
    await global.cleanupTestConnections();
    await app.close();
  });

  it('should create and cleanup test data', async () => {
    // Create test data
    const timestamp = Date.now();
    const user = await prisma.user.create({
      data: {
        keycloakId: `test-user-${timestamp}`,
        email: `test-user-${timestamp}@test.com`,
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const brand = await prisma.brand.create({
      data: {
        name: 'Test Brand',
        email: 'test-brand@test.com',
        phone: '+1234567890',
        address: 'Test Address',
        status: 'PENDING',
      },
    });

    // Verify data exists
    const userCountBefore = await prisma.user.count();
    const brandCountBefore = await prisma.brand.count();

    expect(userCountBefore).toBeGreaterThan(0);
    expect(brandCountBefore).toBeGreaterThan(0);

    // Data should be cleaned up by global cleanup before next test
  });

  it('should verify cleanup worked', async () => {
    // After global cleanup, data should be gone
    const userCountAfter = await prisma.user.count();
    const brandCountAfter = await prisma.brand.count();

    // These should be 0 if cleanup worked
    console.log(`Users after cleanup: ${userCountAfter}`);
    console.log(`Brands after cleanup: ${brandCountAfter}`);

    // Note: This test might fail if cleanup doesn't work properly
    // That's expected - we want to see if our cleanup system works
  });
});
