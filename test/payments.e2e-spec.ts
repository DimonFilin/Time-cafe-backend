import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TransactionStatus, TransactionType } from '@prisma/client';

interface CardResponse {
  id: string;
  last4Digits: string;
  cardType: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  isActive: boolean;
  holderName?: string;
  createdAt: Date;
}

interface TransactionResponse {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  currency: string;
  cardId?: string;
  orderId?: string;
  description?: string;
  createdAt: Date;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
  };
}

describe('Payments Endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testUsers: string[] = [];
  const testCards: string[] = [];
  const testTransactions: string[] = [];

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
      await prisma.transaction.deleteMany({
        where: {
          OR: [
            { user: { email: { contains: '@example.com' } } },
            { user: { email: { contains: 'test-' } } },
          ],
        },
      });
      await prisma.paymentCard.deleteMany({
        where: {
          OR: [
            { user: { email: { contains: '@example.com' } } },
            { user: { email: { contains: 'test-' } } },
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
    await app.close();
  });

  describe('POST /users/cards', () => {
    let userToken: string;

    beforeAll(async () => {
      const email = `test-payments-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
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

      userToken = (registerResponse.body as AuthResponse).accessToken;
    });

    it('should add a payment card with valid data', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/users/cards')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cardNumber: '4242424242424242',
          expiryMonth: 12,
          expiryYear: new Date().getFullYear() + 2,
          cvv: '123',
          holderName: 'Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('last4Digits', '4242');
      expect(response.body).toHaveProperty('cardType', 'visa');
      expect(response.body).toHaveProperty('isDefault', true);
      expect(response.body).toHaveProperty('isActive', true);

      const cardResponse = response.body as CardResponse;
      if (cardResponse.id) {
        testCards.push(cardResponse.id);
      }
    });

    it('should add a second card and set first as default', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/users/cards')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cardNumber: '5555555555554444',
          expiryMonth: 11,
          expiryYear: new Date().getFullYear() + 2,
          cvv: '456',
        })
        .expect(201);

      expect(response.body).toHaveProperty('last4Digits', '4444');
      expect(response.body).toHaveProperty('cardType', 'mastercard');
      expect(response.body).toHaveProperty('isDefault', false);

      const cardResponse = response.body as CardResponse;
      if (cardResponse.id) {
        testCards.push(cardResponse.id);
      }
    });

    it('should return 400 for invalid card number', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/users/cards')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cardNumber: '123',
          expiryMonth: 12,
          expiryYear: new Date().getFullYear() + 2,
          cvv: '123',
        })
        .expect(400);
    });

    it('should return 409 for expired card', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/users/cards')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cardNumber: '4242424242424242',
          expiryMonth: 1,
          expiryYear: new Date().getFullYear() - 1, // Прошедший год
          cvv: '123',
        })
        .expect(409);
    });

    it('should return 401 without token', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/users/cards')
        .send({
          cardNumber: '4242424242424242',
          expiryMonth: 12,
          expiryYear: new Date().getFullYear() + 2,
          cvv: '123',
        })
        .expect(401);
    });
  });

  describe('GET /users/cards', () => {
    let userToken: string;

    beforeAll(async () => {
      const email = `test-get-cards-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
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

      userToken = (registerResponse.body as { accessToken: string })
        .accessToken;

      const user = await prisma.user.findFirst({
        where: { email, deletedAt: null },
      });

      if (user) {
        await prisma.paymentCard.create({
          data: {
            userId: user.id,
            last4Digits: '1234',
            cardType: 'visa',
            expiryMonth: 12,
            expiryYear: new Date().getFullYear() + 2,
            providerToken: 'token_123',
            isDefault: true,
            isActive: true,
          },
        });
      }
    });

    it('should return list of user cards', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/users/cards')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const cards = response.body as CardResponse[];
      if (cards.length > 0) {
        expect(cards[0]).toHaveProperty('id');
        expect(cards[0]).toHaveProperty('last4Digits');
        expect(cards[0]).toHaveProperty('cardType');
      }
    });

    it('should return 401 without token', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/users/cards')
        .expect(401);
    });
  });

  describe('POST /users/payments', () => {
    let userToken: string;
    let cardId: string;

    beforeAll(async () => {
      const email = `test-payment-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
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

      userToken = (registerResponse.body as { accessToken: string })
        .accessToken;

      const user = await prisma.user.findFirst({
        where: { email, deletedAt: null },
      });

      if (user) {
        const card = await prisma.paymentCard.create({
          data: {
            userId: user.id,
            last4Digits: '4242',
            cardType: 'visa',
            expiryMonth: 12,
            expiryYear: new Date().getFullYear() + 2,
            providerToken: 'token_123',
            isDefault: true,
            isActive: true,
          },
        });
        cardId = card.id;
        testCards.push(card.id);
      }
    });

    it('should create a payment transaction', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/users/payments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cardId,
          amount: 1000.0,
          description: 'Test payment',
        })
        .expect(201);

      const paymentResponse = response.body as TransactionResponse;
      expect(paymentResponse).toHaveProperty('id');
      expect(paymentResponse).toHaveProperty('type', TransactionType.PAYMENT);
      expect(paymentResponse).toHaveProperty(
        'status',
        TransactionStatus.COMPLETED,
      );
      expect(paymentResponse).toHaveProperty('amount', '1000');
      expect(paymentResponse).toHaveProperty('cardId', cardId);

      if (paymentResponse.id) {
        testTransactions.push(paymentResponse.id);
      }
    });

    it('should return 400 for invalid amount', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/users/payments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cardId,
          amount: -100,
        })
        .expect(400);
    });

    it('should return 404 for non-existent card', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/users/payments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cardId: '00000000-0000-0000-0000-000000000000',
          amount: 1000,
        })
        .expect(404);
    });
  });

  describe('GET /users/transactions', () => {
    let userToken: string;

    beforeAll(async () => {
      const email = `test-transactions-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
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

      userToken = (registerResponse.body as { accessToken: string })
        .accessToken;

      const user = await prisma.user.findFirst({
        where: { email, deletedAt: null },
      });

      if (user) {
        const card = await prisma.paymentCard.create({
          data: {
            userId: user.id,
            last4Digits: '4242',
            cardType: 'visa',
            expiryMonth: 12,
            expiryYear: new Date().getFullYear() + 2,
            providerToken: 'token_123',
            isDefault: true,
            isActive: true,
          },
        });
        testCards.push(card.id);

        const transaction = await prisma.transaction.create({
          data: {
            userId: user.id,
            type: TransactionType.PAYMENT,
            status: TransactionStatus.COMPLETED,
            amount: 500,
            currency: 'RUB',
            cardId: card.id,
            provider: 'stripe',
            providerTransactionId: 'ch_test_123',
          },
        });
        testTransactions.push(transaction.id);
      }
    });

    it('should return transaction history', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/users/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const transactions = response.body as TransactionResponse[];
      if (transactions.length > 0) {
        expect(transactions[0]).toHaveProperty('id');
        expect(transactions[0]).toHaveProperty('type');
        expect(transactions[0]).toHaveProperty('status');
        expect(transactions[0]).toHaveProperty('amount');
      }
    });

    it('should support pagination', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/users/transactions?limit=10&offset=0')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /users/transactions/:id/refund', () => {
    let userToken: string;
    let transactionId: string;

    beforeAll(async () => {
      const email = `test-refund-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
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

      userToken = (registerResponse.body as { accessToken: string })
        .accessToken;

      const user = await prisma.user.findFirst({
        where: { email, deletedAt: null },
      });

      if (user) {
        const card = await prisma.paymentCard.create({
          data: {
            userId: user.id,
            last4Digits: '4242',
            cardType: 'visa',
            expiryMonth: 12,
            expiryYear: new Date().getFullYear() + 2,
            providerToken: 'token_123',
            isDefault: true,
            isActive: true,
          },
        });
        testCards.push(card.id);

        const transaction = await prisma.transaction.create({
          data: {
            userId: user.id,
            type: TransactionType.PAYMENT,
            status: TransactionStatus.COMPLETED,
            amount: 1000,
            currency: 'RUB',
            cardId: card.id,
            provider: 'stripe',
            providerTransactionId: 'ch_test_123',
          },
        });
        transactionId = transaction.id;
        testTransactions.push(transaction.id);
      }
    });

    it('should create a refund transaction', async () => {
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/users/transactions/${transactionId}/refund`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 500,
          description: 'Partial refund',
        })
        .expect(201);

      const refundResponse = response.body as TransactionResponse;
      expect(refundResponse).toHaveProperty('id');
      expect(refundResponse).toHaveProperty('type', TransactionType.REFUND);
      expect(refundResponse).toHaveProperty(
        'status',
        TransactionStatus.COMPLETED,
      );
      expect(refundResponse).toHaveProperty('amount', '-500');

      if (refundResponse.id) {
        testTransactions.push(refundResponse.id);
      }
    });

    it('should return 400 for refund exceeding original amount', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/users/transactions/${transactionId}/refund`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 2000,
        })
        .expect(400);
    });
  });
});
