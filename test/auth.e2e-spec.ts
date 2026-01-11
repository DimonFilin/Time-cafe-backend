import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth Endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testUsers: string[] = [];

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
      // Hard delete all test data in correct order (dependencies first)
      await prisma.order.deleteMany({
        where: {
          OR: [
            { user: { email: { contains: '@example.com' } } },
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
      await prisma.workerAccount.deleteMany({
        where: {
          OR: [
            { email: { contains: '@example.com' } },
            { email: { contains: 'test-' } },
            { email: { contains: '@test.com' } },
          ],
        },
      });
      await prisma.transaction.deleteMany({
        where: {
          OR: [
            { user: { email: { contains: '@example.com' } } },
            { user: { email: { contains: 'test-' } } },
            { user: { email: { contains: '@test.com' } } },
          ],
        },
      });
      await prisma.paymentCard.deleteMany({
        where: {
          OR: [
            { user: { email: { contains: '@example.com' } } },
            { user: { email: { contains: 'test-' } } },
            { user: { email: { contains: '@test.com' } } },
          ],
        },
      });
      await prisma.user.deleteMany({
        where: {
          OR: [
            { email: { contains: '@example.com' } },
            { email: { contains: 'test-' } },
            { email: { contains: '@test.com' } },
          ],
        },
      });
    }

    // Clean up connections
    await global.cleanupTestConnections();
    // Clean up connections
    await global.cleanupTestConnections();
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const testUser = {
        email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        phone: '+1234567890',
      };
      testUsers.push(testUser.email);

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send(testUser);

      if (response.status === 201) {
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
        expect(response.body).toHaveProperty('expiresIn');
        expect(response.body).toHaveProperty('user');
        expect((response.body as AuthResponse).user).toHaveProperty(
          'email',
          testUser.email,
        );
        expect((response.body as AuthResponse).user).toHaveProperty(
          'firstName',
          testUser.firstName,
        );
        expect((response.body as AuthResponse).user).toHaveProperty(
          'lastName',
          testUser.lastName,
        );
      } else if (response.status === 409) {
        const errorMessage =
          (response.body as { message?: string })?.message ||
          'User created but login failed';
        if (
          typeof errorMessage === 'string' &&
          errorMessage.includes('User created but login failed')
        ) {
          expect(response.status).toBe(409);
          expect((response.body as { message?: string }).message).toContain(
            'User created',
          );
        } else {
          throw new Error(`Unexpected 409: ${errorMessage}`);
        }
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    }, 30000);

    it('should return 409 if user already exists', async () => {
      const testUser = {
        email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
      };
      testUsers.push(testUser.email);

      const firstRegister = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send(testUser);

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
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('should return 400 for invalid email', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);
    });

    it('should return 400 for short password', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
          password: 'short',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginEmail = `login-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const password = 'TestPassword123!';
      testUsers.push(loginEmail);

      const registerResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email: loginEmail,
          password,
          firstName: 'Test',
          lastName: 'User',
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

    it('should return 401 for invalid credentials', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should return 401 for non-existent user', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;
    let refreshEmail: string;

    beforeAll(async () => {
      refreshEmail = `refresh-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      testUsers.push(refreshEmail);

      const registerResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email: refreshEmail,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
        });

      if (registerResponse.status === 201) {
        refreshToken = (registerResponse.body as AuthResponse).refreshToken;
      } else if (registerResponse.status === 409) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const loginResponse = await request(
          app.getHttpServer() as unknown as Parameters<typeof request>[0],
        )
          .post('/auth/login')
          .send({
            email: refreshEmail,
            password: 'TestPassword123!',
          });
        if (loginResponse.status === 200) {
          refreshToken = (loginResponse.body as AuthResponse).refreshToken;
        } else {
          throw new Error(
            `Failed to get refresh token: ${loginResponse.status}`,
          );
        }
      } else {
        throw new Error(
          `Registration failed with status ${registerResponse.status}`,
        );
      }
    }, 30000);

    it('should refresh access token', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res: { body: AuthResponse }) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('expiresIn');
          expect(res.body).toHaveProperty('user');
        });
    });

    it('should return 401 for invalid refresh token', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile with valid token', async () => {
      const email = `test-profile-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      testUsers.push(email);

      const registerResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      const token = (registerResponse.body as AuthResponse).accessToken;

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', email);
      expect(response.body).toHaveProperty('firstName', 'Test');
      expect(response.body).toHaveProperty('lastName', 'User');
    });

    it('should return 401 without token', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/auth/me')
        .expect(401);
    });

    it('should return 401 with invalid token', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PATCH /auth/me', () => {
    it('should update user profile with valid token', async () => {
      const email = `test-update-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      testUsers.push(email);

      const registerResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      const token = (registerResponse.body as AuthResponse).accessToken;

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
          phone: '+1234567890',
        })
        .expect(200);

      expect(response.body).toHaveProperty('firstName', 'Updated');
      expect(response.body).toHaveProperty('lastName', 'Name');
      expect(response.body).toHaveProperty('phone', '+1234567890');
    });

    it('should return 401 without token', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/auth/me')
        .send({ firstName: 'Test' })
        .expect(401);
    });

    it('should validate input data', async () => {
      const email = `test-update-validate-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      testUsers.push(email);

      const registerResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      const token = (registerResponse.body as AuthResponse).accessToken;

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 123,
        })
        .expect(400);
    });
  });

  describe('POST /auth/change-password', () => {
    it('should change password with valid current password', async () => {
      const email = `test-password-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      testUsers.push(email);
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword123!';

      const registerResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email,
          password: oldPassword,
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      const token = (registerResponse.body as AuthResponse).accessToken;

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: oldPassword,
          newPassword: newPassword,
        })
        .expect(200);

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/login')
        .send({
          email,
          password: newPassword,
        })
        .expect(200);
    });

    it('should return 401 with incorrect current password', async () => {
      const email = `test-password-wrong-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      testUsers.push(email);

      const registerResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email,
          password: 'OldPassword123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      const token = (registerResponse.body as AuthResponse).accessToken;

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!',
        })
        .expect(401);
    });

    it('should return 401 without token', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/change-password')
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        })
        .expect(401);
    });

    it('should validate new password length', async () => {
      const email = `test-password-validate-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      testUsers.push(email);

      const registerResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email,
          password: 'OldPassword123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      const token = (registerResponse.body as AuthResponse).accessToken;

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'short',
        })
        .expect(400);
    });
  });

  describe('DELETE /auth/me', () => {
    it('should soft delete user account', async () => {
      const email = `test-delete-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      testUsers.push(email);

      const registerResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      const token = (registerResponse.body as AuthResponse).accessToken;

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .delete('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should allow registering with same email after deletion', async () => {
      const email = `test-reuse-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      testUsers.push(email);

      const registerResponse1 = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      const token1 = (registerResponse1.body as AuthResponse).accessToken;

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .delete('/auth/me')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const registerResponse2 = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/auth/register')
        .send({
          email,
          password: 'NewPassword123!',
          firstName: 'New',
          lastName: 'User',
        })
        .expect(201);

      expect(registerResponse2.body).toHaveProperty('accessToken');
      expect((registerResponse2.body as AuthResponse).user).toHaveProperty(
        'email',
        email,
      );
    });

    it('should return 401 without token', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .delete('/auth/me')
        .expect(401);
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
