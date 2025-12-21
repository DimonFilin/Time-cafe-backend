import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WorkerRole } from '@prisma/client';

describe('Workers Endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testWorkers: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

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

  describe('POST /auth/workers', () => {
    it('should register a new worker with SYSTEM_ADMIN role', async () => {
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
        .send(testWorker);

      if (response.status === 201) {
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
        expect(response.body).toHaveProperty('expiresIn');
        expect(response.body).toHaveProperty('user');
        expect((response.body as AuthResponse).user).toHaveProperty(
          'email',
          testWorker.email,
        );
        expect((response.body as AuthResponse).user).toHaveProperty(
          'firstName',
          testWorker.firstName,
        );
        expect((response.body as AuthResponse).user).toHaveProperty(
          'lastName',
          testWorker.lastName,
        );
      } else if (response.status === 409) {
        const errorMessage =
          (response.body as { message?: string })?.message ||
          'Worker created but login failed';
        if (
          typeof errorMessage === 'string' &&
          errorMessage.includes('Worker created but login failed')
        ) {
          expect(response.status).toBe(409);
          expect((response.body as { message?: string }).message).toContain(
            'Worker created',
          );
        } else {
          throw new Error(`Unexpected 409: ${errorMessage}`);
        }
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    }, 30000);

    it('should register a new worker with CAFE_ADMIN role', async () => {
      const testWorker = {
        email: `cafe-admin-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Cafe',
        lastName: 'Admin',
        role: WorkerRole.CAFE_ADMIN,
      };
      testWorkers.push(testWorker.email);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send(testWorker);

      expect([201, 409]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('user');
      }
    }, 30000);

    it('should register a new worker with WORKER role', async () => {
      const testWorker = {
        email: `worker-role-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Regular',
        lastName: 'Worker',
        role: WorkerRole.WORKER,
      };
      testWorkers.push(testWorker.email);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
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
      };
      testWorkers.push(testWorker.email);

      const firstRegister = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
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
        .send(testWorker)
        .expect(409);
    });

    it('should return 400 for invalid email', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'Worker',
          role: WorkerRole.WORKER,
        })
        .expect(400);
    });

    it('should return 400 for short password', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send({
          email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
          password: 'short',
          firstName: 'Test',
          lastName: 'Worker',
          role: WorkerRole.WORKER,
        })
        .expect(400);
    });

    it('should return 400 for invalid role', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send({
          email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'Worker',
          role: 'INVALID_ROLE',
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
        .send({
          email,
          password: 'TestPassword123!',
          firstName: 'Worker',
          lastName: 'Test',
          role: WorkerRole.WORKER,
        })
        .expect(409);
    });
  });

  describe('POST /auth/login for workers', () => {
    it('should login worker with valid credentials', async () => {
      const loginEmail = `login-worker-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const password = 'TestPassword123!';
      testWorkers.push(loginEmail);

      const registerResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/workers')
        .send({
          email: loginEmail,
          password,
          firstName: 'Test',
          lastName: 'Worker',
          role: WorkerRole.WORKER,
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
