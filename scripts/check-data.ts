import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  console.log('🔍 Checking database data...\n');

  try {
    // Check worker accounts
    const workerAccounts = await prisma.workerAccount.findMany({
      where: {
        email: 'multiacc.email@gmail.com',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        keycloakId: true,
        brandId: true,
        cafeId: true,
      },
    });

    console.log('👥 Worker Accounts for multiacc.email@gmail.com:');
    console.log(`   Found: ${workerAccounts.length} accounts\n`);

    workerAccounts.forEach((account, index) => {
      console.log(`   ${index + 1}. ${account.firstName} ${account.lastName}`);
      console.log(`      Role: ${account.role}`);
      console.log(`      Keycloak ID: ${account.keycloakId}`);
      console.log(`      Brand ID: ${account.brandId || 'N/A'}`);
      console.log(`      Cafe ID: ${account.cafeId || 'N/A'}`);
      console.log('');
    });

    // Check all worker accounts
    const allWorkers = await prisma.workerAccount.count();
    console.log(`📊 Total worker accounts: ${allWorkers}`);

    // Check users
    const users = await prisma.user.count();
    console.log(`📊 Total users: ${users}`);

    // Check brands
    const brands = await prisma.brand.count();
    console.log(`📊 Total brands: ${brands}`);

    // Check cafes
    const cafes = await prisma.cafe.count();
    console.log(`📊 Total cafes: ${cafes}`);

    // Check orders
    const orders = await prisma.order.count();
    console.log(`📊 Total orders: ${orders}`);

    // Check activity logs
    const logs = await prisma.activityLog.count();
    console.log(`📊 Total activity logs: ${logs}`);
  } catch (error) {
    console.error('❌ Error checking data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

void checkData();
