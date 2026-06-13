import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { KeycloakService } from '../src/modules/auth/services/keycloak.service';
import {
  createSystemAdmin,
  getTestFactoriesDeps,
} from './helpers/test-factories';
import { floorBonus } from '../src/modules/loyalty/loyalty-calculations';

describe('Loyalty (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let guestId: string;
  let bronzeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    const keycloakService = moduleFixture.get(KeycloakService);
    const deps = getTestFactoriesDeps({ app, prisma, keycloakService });
    const admin = await createSystemAdmin(deps);
    adminToken = admin.token;

    await prisma.platformLoyaltySettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        enabled: true,
        accrualDelayHours: 120,
        minTopUpForBonus: 20,
      },
      update: { enabled: true, minTopUpForBonus: 20 },
    });

    const bronze = await prisma.loyaltyTier.upsert({
      where: { id: 'test-tier-bronze' },
      create: {
        id: 'test-tier-bronze',
        name: 'Test Bronze',
        bonusPercent: 5,
        sortOrder: 1,
        isDefault: true,
        isActive: true,
      },
      update: { bonusPercent: 5, isDefault: true },
    });
    bronzeId = bronze.id;

    const guestRes = await request(app.getHttpServer())
      .post('/admin/guests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Loyalty',
        lastName: 'Tester',
        phone: `+7999${Date.now().toString().slice(-7)}`,
      })
      .expect((res) => expect([200, 201]).toContain(res.status));
    guestId = guestRes.body.id;
  });

  afterAll(async () => {
    if (prisma && guestId) {
      await prisma.pendingLoyaltyBonus.deleteMany({ where: { guestId } });
      await prisma.walletLedgerEntry.deleteMany({ where: { guestId } });
      await prisma.loyaltyTierHistory.deleteMany({ where: { guestId } });
      await prisma.networkGuest
        .delete({ where: { id: guestId } })
        .catch(() => undefined);
    }
    await app?.close();
  });

  it('calculates floor bonus 1111 * 13% = 144', () => {
    expect(floorBonus(1111, 13)).toBe(144);
  });

  it('preview top-up shows bonus for enabled platform', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/guests/${guestId}/top-up/preview`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 1000, paymentType: 'TOP_UP_CASH' })
      .expect(200);

    expect(res.body.willAccrue).toBe(true);
    expect(res.body.hypotheticBonus).toBe(50);
  });

  it('top-up creates pending bonus', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/guests/${guestId}/top-up`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 1000, paymentType: 'TOP_UP_CASH' })
      .expect(200);

    expect(res.body.pending).toBeTruthy();
    expect(Number(res.body.pending.bonusAmount)).toBe(50);
  });

  it('manual tier change requires reason', async () => {
    const gold = await prisma.loyaltyTier.create({
      data: {
        name: 'Test Gold',
        bonusPercent: 13,
        sortOrder: 99,
        isActive: true,
      },
    });

    await request(app.getHttpServer())
      .patch(`/admin/loyalty/guests/${guestId}/tier`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tierId: gold.id, reason: 'VIP client' })
      .expect(200);

    await prisma.loyaltyTier.delete({ where: { id: gold.id } });
  });
});
