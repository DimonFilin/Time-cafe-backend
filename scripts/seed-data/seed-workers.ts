import { PrismaClient, WorkerRole } from '@prisma/client';
import { ACCOUNTS } from './fixtures';
import { upsertKeycloakUsers } from '../lib/keycloak-admin';
import type { SeedContext } from './types';

export async function seedWorkers(
  prisma: PrismaClient,
  ctx: Pick<SeedContext, 'brands' | 'cafes'>,
): Promise<Pick<SeedContext, 'keycloakIds' | 'workers'>> {
  console.log('\n👥 Workers & Keycloak...');

  const kcInputs = [
    {
      email: ACCOUNTS.multiacc.email,
      password: ACCOUNTS.multiacc.password,
      firstName: 'Мульти',
      lastName: 'Аккаунт',
    },
    {
      email: ACCOUNTS.systemAdmin.email,
      password: ACCOUNTS.systemAdmin.password,
      firstName: ACCOUNTS.systemAdmin.firstName,
      lastName: ACCOUNTS.systemAdmin.lastName,
    },
    {
      email: ACCOUNTS.minsk2.admin.email,
      password: ACCOUNTS.minsk2.admin.password,
      firstName: ACCOUNTS.minsk2.admin.firstName,
      lastName: ACCOUNTS.minsk2.admin.lastName,
    },
    {
      email: ACCOUNTS.minsk2.worker.email,
      password: ACCOUNTS.minsk2.worker.password,
      firstName: ACCOUNTS.minsk2.worker.firstName,
      lastName: ACCOUNTS.minsk2.worker.lastName,
    },
    {
      email: ACCOUNTS.brest.admin.email,
      password: ACCOUNTS.brest.admin.password,
      firstName: ACCOUNTS.brest.admin.firstName,
      lastName: ACCOUNTS.brest.admin.lastName,
    },
    {
      email: ACCOUNTS.brest.worker.email,
      password: ACCOUNTS.brest.worker.password,
      firstName: ACCOUNTS.brest.worker.firstName,
      lastName: ACCOUNTS.brest.worker.lastName,
    },
  ];

  const keycloakIds = await upsertKeycloakUsers(kcInputs);
  const multiId = keycloakIds[ACCOUNTS.multiacc.email];
  const { timeCafeBy, uyutnyChas } = ctx.brands;
  const { minskNezavisimosti, minskOktyabrskaya, brestCenter } = ctx.cafes;

  const multiacc = await Promise.all([
    prisma.workerAccount.create({
      data: {
        keycloakId: multiId,
        email: ACCOUNTS.multiacc.email,
        firstName: 'Мульти',
        lastName: 'Системный',
        role: WorkerRole.SYSTEM_ADMIN,
      },
    }),
    prisma.workerAccount.create({
      data: {
        keycloakId: multiId,
        email: ACCOUNTS.multiacc.email,
        firstName: 'Мульти',
        lastName: 'Бренд',
        role: WorkerRole.BRAND_ADMIN,
        brandId: timeCafeBy.id,
      },
    }),
    prisma.workerAccount.create({
      data: {
        keycloakId: multiId,
        email: ACCOUNTS.multiacc.email,
        firstName: 'Мульти',
        lastName: 'Админ кафе',
        role: WorkerRole.CAFE_ADMIN,
        brandId: timeCafeBy.id,
        cafeId: minskNezavisimosti.id,
      },
    }),
    prisma.workerAccount.create({
      data: {
        keycloakId: multiId,
        email: ACCOUNTS.multiacc.email,
        firstName: 'Мульти',
        lastName: 'Сотрудник 1',
        role: WorkerRole.WORKER,
        brandId: timeCafeBy.id,
        cafeId: minskNezavisimosti.id,
      },
    }),
    prisma.workerAccount.create({
      data: {
        keycloakId: multiId,
        email: ACCOUNTS.multiacc.email,
        firstName: 'Мульти',
        lastName: 'Сотрудник 2',
        role: WorkerRole.WORKER,
        brandId: timeCafeBy.id,
        cafeId: minskNezavisimosti.id,
      },
    }),
  ]);

  const systemAdmin = await prisma.workerAccount.create({
    data: {
      keycloakId: keycloakIds[ACCOUNTS.systemAdmin.email],
      email: ACCOUNTS.systemAdmin.email,
      firstName: ACCOUNTS.systemAdmin.firstName,
      lastName: ACCOUNTS.systemAdmin.lastName,
      role: WorkerRole.SYSTEM_ADMIN,
    },
  });

  const minsk2Admin = await prisma.workerAccount.create({
    data: {
      keycloakId: keycloakIds[ACCOUNTS.minsk2.admin.email],
      email: ACCOUNTS.minsk2.admin.email,
      firstName: ACCOUNTS.minsk2.admin.firstName,
      lastName: ACCOUNTS.minsk2.admin.lastName,
      role: WorkerRole.CAFE_ADMIN,
      brandId: timeCafeBy.id,
      cafeId: minskOktyabrskaya.id,
    },
  });

  const minsk2Worker = await prisma.workerAccount.create({
    data: {
      keycloakId: keycloakIds[ACCOUNTS.minsk2.worker.email],
      email: ACCOUNTS.minsk2.worker.email,
      firstName: ACCOUNTS.minsk2.worker.firstName,
      lastName: ACCOUNTS.minsk2.worker.lastName,
      role: WorkerRole.WORKER,
      brandId: timeCafeBy.id,
      cafeId: minskOktyabrskaya.id,
    },
  });

  const brestAdmin = await prisma.workerAccount.create({
    data: {
      keycloakId: keycloakIds[ACCOUNTS.brest.admin.email],
      email: ACCOUNTS.brest.admin.email,
      firstName: ACCOUNTS.brest.admin.firstName,
      lastName: ACCOUNTS.brest.admin.lastName,
      role: WorkerRole.CAFE_ADMIN,
      brandId: uyutnyChas.id,
      cafeId: brestCenter.id,
    },
  });

  const brestWorker = await prisma.workerAccount.create({
    data: {
      keycloakId: keycloakIds[ACCOUNTS.brest.worker.email],
      email: ACCOUNTS.brest.worker.email,
      firstName: ACCOUNTS.brest.worker.firstName,
      lastName: ACCOUNTS.brest.worker.lastName,
      role: WorkerRole.WORKER,
      brandId: uyutnyChas.id,
      cafeId: brestCenter.id,
    },
  });

  return {
    keycloakIds,
    workers: {
      multiacc,
      systemAdmin,
      minsk2Admin,
      minsk2Worker,
      brestAdmin,
      brestWorker,
    },
  };
}
