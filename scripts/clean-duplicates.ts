import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDuplicates() {
  console.log('🧹 Cleaning duplicate data...\n');

  try {
    // Get all worker accounts for multiacc.email@gmail.com
    const multiAccounts = await prisma.workerAccount.findMany({
      where: {
        email: 'multiacc.email@gmail.com',
      },
      orderBy: {
        createdAt: 'asc', // Keep oldest ones
      },
    });

    console.log(
      `Found ${multiAccounts.length} worker accounts for multiacc.email@gmail.com`,
    );

    if (multiAccounts.length > 4) {
      // Keep first 4, delete the rest
      const toKeep = multiAccounts.slice(0, 4);
      const toDelete = multiAccounts.slice(4);

      console.log(`\nKeeping ${toKeep.length} accounts:`);
      toKeep.forEach((acc, i) => {
        console.log(
          `  ${i + 1}. ${acc.firstName} ${acc.lastName} (${acc.role})`,
        );
      });

      console.log(`\nDeleting ${toDelete.length} duplicate accounts:`);
      toDelete.forEach((acc, i) => {
        console.log(
          `  ${i + 1}. ${acc.firstName} ${acc.lastName} (${acc.role})`,
        );
      });

      // Delete activity logs for accounts to be deleted
      for (const account of toDelete) {
        const logsDeleted = await prisma.activityLog.deleteMany({
          where: { workerId: account.id },
        });
        console.log(
          `  Deleted ${logsDeleted.count} activity logs for ${account.id}`,
        );
      }

      // Delete duplicate accounts
      const deleted = await prisma.workerAccount.deleteMany({
        where: {
          id: {
            in: toDelete.map((acc) => acc.id),
          },
        },
      });

      console.log(`\n✓ Deleted ${deleted.count} duplicate worker accounts`);
    } else {
      console.log('✓ No duplicates found');
    }

    // Check for duplicate brands
    const brands = await prisma.brand.findMany();
    const brandNames = brands.map((b) => b.name);
    const duplicateBrands = brandNames.filter(
      (name, index) => brandNames.indexOf(name) !== index,
    );

    if (duplicateBrands.length > 0) {
      console.log(
        `\n⚠️  Found duplicate brands: ${duplicateBrands.join(', ')}`,
      );
      console.log(
        '   Run "npm run prisma:migrate reset" and "npm run seed" to clean up',
      );
    }

    // Show final stats
    console.log('\n📊 Final Statistics:');
    const stats = {
      workerAccounts: await prisma.workerAccount.count(),
      users: await prisma.user.count(),
      brands: await prisma.brand.count(),
      cafes: await prisma.cafe.count(),
      orders: await prisma.order.count(),
      activityLogs: await prisma.activityLog.count(),
    };

    console.log(`   Worker Accounts: ${stats.workerAccounts}`);
    console.log(`   Users: ${stats.users}`);
    console.log(`   Brands: ${stats.brands}`);
    console.log(`   Cafes: ${stats.cafes}`);
    console.log(`   Orders: ${stats.orders}`);
    console.log(`   Activity Logs: ${stats.activityLogs}`);

    console.log('\n✅ Cleanup completed!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void cleanDuplicates();
