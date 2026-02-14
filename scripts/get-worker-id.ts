import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const worker = await prisma.workerAccount.findFirst({
    where: {
      email: 'multiacc.email@gmail.com',
      role: 'WORKER',
    },
    include: {
      cafe: true,
      brand: true,
    },
  });

  if (!worker) {
    console.log('❌ Worker not found');
    return;
  }

  console.log('\n✅ Worker Account Found:\n');
  console.log('📧 Email:', worker.email);
  console.log('👤 Name:', worker.firstName, worker.lastName);
  console.log('🆔 Worker ID:', worker.id);
  console.log('🏢 Brand:', worker.brand?.name || 'N/A');
  console.log('☕ Cafe:', worker.cafe?.name || 'N/A');
  console.log('🔑 Keycloak ID:', worker.keycloakId);
  console.log('\n📋 To use this account:');
  console.log('   1. Open DevTools (F12)');
  console.log('   2. Go to Application → Cookies');
  console.log('   3. Set cookie "tc_account_id" to:', worker.id);
  console.log('   4. Refresh the page\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
