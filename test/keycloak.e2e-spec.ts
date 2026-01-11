import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Keycloak Integration (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get access token for protected endpoints
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'time-cafe-shared';
    const clientId = process.env.KEYCLOAK_CLIENT_ID || 'backend-shared-api';
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

    if (clientSecret) {
      try {
        const tokenResponse = await fetch(
          `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: 'client_credentials',
            }),
          },
        );

        if (tokenResponse.ok) {
          const tokenData = (await tokenResponse.json()) as {
            access_token?: string;
          };
          accessToken = tokenData.access_token || '';
        }
      } catch (error: unknown) {
        console.warn(
          'Could not get Keycloak token for tests:',
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
    }
  });

  afterAll(async () => {
    // Clean up connections
    await global.cleanupTestConnections();
    await app.close();
  });

  describe('/auth-test/public (GET)', () => {
    it('should return 200 without authentication', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/auth-test/public')
        .expect(200)
        .expect((res: { body: { message?: string; timestamp?: string } }) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('/auth-test/protected (GET)', () => {
    it('should return 401 without token', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/auth-test/protected')
        .expect(401);
    });

    it('should return 200 with valid token', () => {
      if (!accessToken) {
        console.warn('Skipping test - no access token available');
        return Promise.resolve();
      }

      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/auth-test/protected')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect(
          (res: { body: { authenticated?: boolean; clientId?: string } }) => {
            expect(res.body).toHaveProperty('authenticated', true);
            expect(res.body).toHaveProperty('clientId');
          },
        );
    });
  });

  describe('/auth-test/keycloak-ping (GET)', () => {
    it('should check Keycloak connectivity', () => {
      return request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/auth-test/keycloak-ping')
        .expect(200)
        .expect((res: { body: { status?: string; accessible?: boolean } }) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('accessible');
          expect(res.body.accessible).toBe(true);
        });
    });
  });
});
