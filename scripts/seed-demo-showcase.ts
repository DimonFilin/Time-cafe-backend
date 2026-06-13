import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { clearDatabaseFull } from './lib/clear-database-full';
import { clearKeycloakDemoUsers } from './lib/keycloak-admin';
import {
  CAFES,
  DEMO_PASS,
  EXTRA_WORKERS,
  MOBILE_USERS,
  TIMECAFE_CORE_WORKERS,
} from './seed-data/demo-showcase/fixtures';
import { seedShowcaseCore } from './seed-data/demo-showcase/seed-showcase-core';
import { seedShowcaseDemoBooking } from './seed-data/demo-showcase/seed-showcase-demo-booking';
import { seedShowcaseLayout } from './seed-data/demo-showcase/seed-showcase-layout';
import { seedShowcaseReviews } from './seed-data/demo-showcase/seed-showcase-reviews';
import { seedShowcaseUsers } from './seed-data/demo-showcase/seed-showcase-users';
import { seedShowcaseWorkers } from './seed-data/demo-showcase/seed-showcase-workers';

const prisma = new PrismaClient();
const SKIP_CLEAR = process.env.SEED_SKIP_CLEAR === '1';

function writeCredentials(): void {
  const lines: string[] = [
    '# Учётные записи demo-showcase',
    '',
    'Пароли:',
    `- Гости (mobile): \`${DEMO_PASS.user}\``,
    `- Работники: \`${DEMO_PASS.worker}\``,
    `- Админы (cafe/brand/system): \`${DEMO_PASS.admin}\``,
    '',
    '## Мобильное приложение (5 гостей)',
    '',
    '| Email | Имя | Tier |',
    '|-------|-----|------|',
    ...MOBILE_USERS.map(
      (u) => `| ${u.email} | ${u.firstName} ${u.lastName} | ${u.tier} |`,
    ),
    '',
    '## ТаймКафе — 5 ролей (один бренд, без мультиаккаунта)',
    '',
    '| Роль | Email | Кафе |',
    '|------|-------|------|',
    ...TIMECAFE_CORE_WORKERS.map((w) => {
      const role =
        w.role === 'SYSTEM_ADMIN'
          ? 'SYSTEM_ADMIN'
          : w.role === 'BRAND_ADMIN'
            ? 'BRAND_ADMIN'
            : w.role === 'CAFE_ADMIN'
              ? 'CAFE_ADMIN'
              : 'WORKER';
      return `| ${role} | ${w.email} | ${w.cafeKey ?? '—'} |`;
    }),
    '',
    '## Прочие входы (admin-web)',
    '',
    '| Email | Роль | Кафе |',
    '|-------|------|------|',
    ...EXTRA_WORKERS.map(
      (w) =>
        `| ${w.email} | ${w.role} | ${CAFES.find((c) => c.key === w.cafeKey)?.name ?? w.cafeKey} |`,
    ),
    '',
    '## Кафе (11)',
    '',
    ...CAFES.map(
      (c) =>
        `- **${c.name}** (${c.brandKey}) — ~${c.reviewTarget} отзывов, комната «${c.roomName}», до ${c.capacity} чел.`,
    ),
    '',
    'Главная точка для демо: **ТаймКафе — пр. Независимости** (`nezavisimosti`).',
    'Гость для сквозного сценария: **maria.demo@user.demo**.',
    '',
  ];

  const outDir = path.resolve(__dirname, '../../отчеты');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'demo-showcase-credentials.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`\n📄 Credentials: ${outPath}`);
}

async function main() {
  console.log('🎬 Demo showcase seed\n');

  if (!SKIP_CLEAR) {
    console.log('🔐 Clearing demo Keycloak users...');
    const kc = await clearKeycloakDemoUsers();
    console.log(`   deleted: ${kc.deleted.length}, skipped: ${kc.skipped}\n`);

    console.log('🗑️  Clearing database...');
    await clearDatabaseFull(prisma);
    console.log('');
  }

  const core = await seedShowcaseCore(prisma);
  const workers = await seedShowcaseWorkers(prisma, core);
  await seedShowcaseLayout(prisma, core, workers.nezavisimostiAdminId);
  const users = await seedShowcaseUsers(prisma, core);
  await seedShowcaseReviews(prisma, core, users);
  await seedShowcaseDemoBooking(prisma, core, users);

  writeCredentials();

  console.log('\n✅ Demo showcase seed completed!\n');
  console.log('Mobile (guest): maria.demo@user.demo /', DEMO_PASS.user);
  console.log('Worker (main): worker.anna@timecafe.demo /', DEMO_PASS.worker);
  console.log(
    'Cafe admin: admin.nezavisimosti@timecafe.demo /',
    DEMO_PASS.admin,
  );
  console.log('Brand: brand.chief@timecafe.demo /', DEMO_PASS.admin);
  console.log('System: admin.sys@timecafe.demo /', DEMO_PASS.admin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
