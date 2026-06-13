import { PrismaClient } from '@prisma/client';
import { clearDatabaseFull } from './lib/clear-database-full';
import { clearKeycloakDemoUsers } from './lib/keycloak-admin';
import { seedCommerce } from './seed-data/seed-commerce';
import { seedCore } from './seed-data/seed-core';
import { seedExtras } from './seed-data/seed-extras';
import { seedMenuLayout } from './seed-data/seed-menu-layout';
import { seedUsersGuests } from './seed-data/seed-users-guests';
import { seedWorkers } from './seed-data/seed-workers';
import type { SeedContext } from './seed-data/types';

const prisma = new PrismaClient();
const SKIP_CLEAR = process.env.SEED_SKIP_CLEAR === '1';

async function main() {
  console.log('🇧🇾 Belarus demo seed\n');

  if (!SKIP_CLEAR) {
    console.log('🔐 Clearing demo Keycloak users...');
    const kc = await clearKeycloakDemoUsers();
    console.log(`   deleted: ${kc.deleted.length}, skipped: ${kc.skipped}\n`);

    console.log('🗑️  Clearing database...');
    await clearDatabaseFull(prisma);
    console.log('');
  }

  const core = await seedCore(prisma, { keycloakIds: {} });
  const workersPart = await seedWorkers(prisma, {
    brands: core.brands,
    cafes: core.cafes,
  });

  const ctx = {
    ...core,
    ...workersPart,
    users: {} as SeedContext['users'],
  } satisfies Partial<SeedContext>;

  await seedMenuLayout(prisma, ctx as SeedContext);

  const usersPart = await seedUsersGuests(prisma, {
    cafes: core.cafes,
    tiers: core.tiers,
    brands: core.brands,
  });
  ctx.keycloakIds = { ...ctx.keycloakIds, ...usersPart.keycloakIds };
  ctx.users = usersPart.users;

  const fullCtx = ctx as SeedContext;
  await seedCommerce(prisma, fullCtx);
  await seedExtras(prisma, fullCtx);

  console.log('\n✅ Belarus demo seed completed!\n');
  console.log('Cafes:');
  console.log(
    `  1. ${core.cafes.minskNezavisimosti.name} — ${core.cafes.minskNezavisimosti.id}`,
  );
  console.log(
    `  2. ${core.cafes.minskOktyabrskaya.name} — ${core.cafes.minskOktyabrskaya.id}`,
  );
  console.log(
    `  3. ${core.cafes.brestCenter.name} — ${core.cafes.brestCenter.id}`,
  );
  console.log('\nRun: npm run seed:check (optional)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
