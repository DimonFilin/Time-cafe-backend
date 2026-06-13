import { PrismaClient, WorkerRole } from '@prisma/client';
import { upsertKeycloakUsers } from '../../lib/keycloak-admin';
import { DEMO_PASS, EXTRA_WORKERS, TIMECAFE_CORE_WORKERS } from './fixtures';
import type { ShowcaseCore } from './seed-showcase-core';

export type ShowcaseWorkers = {
  byEmail: Record<
    string,
    { id: string; role: WorkerRole; cafeId: string | null }
  >;
  nezavisimostiAdminId: string;
};

export async function seedShowcaseWorkers(
  prisma: PrismaClient,
  core: ShowcaseCore,
): Promise<ShowcaseWorkers> {
  console.log('\n👥 Workers (showcase, no multi-account)...');

  const kcInputs = [
    ...TIMECAFE_CORE_WORKERS.map((w) => ({
      email: w.email,
      password: w.password,
      firstName: w.firstName,
      lastName: w.lastName,
    })),
    ...EXTRA_WORKERS.map((w) => ({
      email: w.email,
      password: DEMO_PASS.worker,
      firstName: w.firstName,
      lastName: w.lastName,
    })),
  ];

  const keycloakIds = await upsertKeycloakUsers(kcInputs);
  const byEmail: ShowcaseWorkers['byEmail'] = {};
  let nezavisimostiAdminId = '';

  for (const w of TIMECAFE_CORE_WORKERS) {
    const brandId = core.brands.timecafe.id;
    const cafeId = w.cafeKey ? core.cafes[w.cafeKey].id : null;
    const row = await prisma.workerAccount.create({
      data: {
        keycloakId: keycloakIds[w.email],
        email: w.email,
        firstName: w.firstName,
        lastName: w.lastName,
        role: w.role as WorkerRole,
        brandId: w.role === WorkerRole.SYSTEM_ADMIN ? null : brandId,
        cafeId:
          w.role === WorkerRole.BRAND_ADMIN ||
          w.role === WorkerRole.SYSTEM_ADMIN
            ? null
            : cafeId,
        shiftStatus: w.role === WorkerRole.WORKER ? 'ON_SHIFT' : 'OFF_SHIFT',
      },
    });
    byEmail[w.email] = { id: row.id, role: row.role, cafeId: row.cafeId };
    if (w.email === 'admin.nezavisimosti@timecafe.demo') {
      nezavisimostiAdminId = row.id;
    }
  }

  for (const w of EXTRA_WORKERS) {
    const row = await prisma.workerAccount.create({
      data: {
        keycloakId: keycloakIds[w.email],
        email: w.email,
        firstName: w.firstName,
        lastName: w.lastName,
        role: w.role as WorkerRole,
        brandId: core.brands[w.brandKey].id,
        cafeId: core.cafes[w.cafeKey].id,
        shiftStatus: 'ON_SHIFT',
      },
    });
    byEmail[w.email] = { id: row.id, role: row.role, cafeId: row.cafeId };
  }

  return { byEmail, nezavisimostiAdminId };
}
