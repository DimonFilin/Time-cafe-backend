import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('System Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Clean up connections
    await global.cleanupTestConnections();
    await app.close();
  });

  describe('/system/ping (GET)', () => {
    it('should return pong', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/system/ping')
        .expect(200)
        .expect(
          (res: {
            body: { status?: string; message?: string; timestamp?: string };
          }) => {
            expect(res.body).toHaveProperty('status', 'ok');
            expect(res.body).toHaveProperty('message', 'pong');
            expect(res.body).toHaveProperty('timestamp');
          },
        );
    });
  });

  describe('/system/health-check (GET)', () => {
    it('should return health status', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/system/health-check')
        .expect(200)
        .expect(
          (res: {
            body: {
              status?: string;
              timestamp?: string;
              checks?: { database?: unknown; storage?: unknown };
            };
          }) => {
            expect(res.body).toHaveProperty('status');
            expect(['healthy', 'unhealthy']).toContain(res.body.status);
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('checks');
            expect(res.body.checks).toHaveProperty('database');
            expect(res.body.checks).toHaveProperty('storage');
          },
        );
    });
  });

  describe('/system/metrics (GET)', () => {
    it('should return system metrics', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/system/metrics')
        .expect(200)
        .expect(
          (res: {
            body: {
              uptime?: number;
              memory?: { heapUsed?: number };
              database?: unknown;
              requests?: { total?: number };
              timestamp?: string;
            };
          }) => {
            expect(res.body).toHaveProperty('uptime');
            expect(res.body).toHaveProperty('memory');
            expect(res.body).toHaveProperty('database');
            expect(res.body).toHaveProperty('requests');
            expect(res.body).toHaveProperty('timestamp');
            expect(typeof res.body.uptime).toBe('number');
            expect(res.body.memory).toHaveProperty('heapUsed');
            expect(res.body.requests).toHaveProperty('total');
          },
        );
    });
  });
});
