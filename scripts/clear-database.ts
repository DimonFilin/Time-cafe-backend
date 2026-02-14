import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Clearing database...\n');

  try {
    // Delete in correct order (respecting foreign keys)
    console.log('Deleting activity logs...');
    await prisma.activityLog.deleteMany();

    console.log('Deleting brand API keys...');
    await prisma.brandApiKey.deleteMany();

    console.log('Deleting brand documents...');
    await prisma.brandDocument.deleteMany();

    console.log('Deleting transactions...');
    await prisma.transaction.deleteMany();

    console.log('Deleting payment cards...');
    await prisma.paymentCard.deleteMany();

    console.log('Deleting reviews...');
    await prisma.review.deleteMany();

    console.log('Deleting order items...');
    await prisma.orderItem.deleteMany();

    console.log('Deleting orders...');
    await prisma.order.deleteMany();

    console.log('Deleting appointments...');
    await prisma.appointment.deleteMany();

    console.log('Deleting users...');
    await prisma.user.deleteMany();

    console.log('Deleting worker accounts...');
    await prisma.workerAccount.deleteMany();

    console.log('Deleting cafes...');
    await prisma.cafe.deleteMany();

    console.log('Deleting brands...');
    await prisma.brand.deleteMany();

    console.log('Deleting regions...');
    await prisma.region.deleteMany();

    console.log('Deleting system settings...');
    await prisma.systemSettings.deleteMany();

    console.log('\n✅ Database cleared successfully!');
    console.log('\n📋 You can now run: npm run seed');
  } catch (error) {
    console.error('\n❌ Error during database clearing:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
