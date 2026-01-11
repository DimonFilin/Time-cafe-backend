// Complete cleanup script
const { PrismaClient } = require('@prisma/client');

async function completeCleanup() {
  const prisma = new PrismaClient();

  try {
    console.log('Starting complete cleanup...');

    // Clean in reverse order to avoid foreign key constraints

    // 1. Clean transactions
    await prisma.transaction.deleteMany({});
    console.log('✓ Transactions cleaned');

    // 2. Clean payment cards
    await prisma.paymentCard.deleteMany({});
    console.log('✓ Payment cards cleaned');

    // 3. Clean appointments
    await prisma.appointment.deleteMany({});
    console.log('✓ Appointments cleaned');

    // 4. Clean reviews
    await prisma.review.deleteMany({});
    console.log('✓ Reviews cleaned');

    // 5. Clean orders and order items
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    console.log('✓ Orders cleaned');

    // 6. Clean brand documents and API keys
    await prisma.brandDocument.deleteMany({});
    await prisma.brandApiKey.deleteMany({});
    console.log('✓ Brand documents and API keys cleaned');

    // 7. Clean cafes
    await prisma.cafe.deleteMany({});
    console.log('✓ Cafes cleaned');

    // 8. Clean brands
    await prisma.brand.deleteMany({});
    console.log('✓ Brands cleaned');

    // 9. Clean regions
    await prisma.region.deleteMany({});
    console.log('✓ Regions cleaned');

    // 10. Clean worker accounts
    await prisma.workerAccount.deleteMany({});
    console.log('✓ Worker accounts cleaned');

    // 11. Clean users
    await prisma.user.deleteMany({});
    console.log('✓ Users cleaned');

    console.log('✅ Complete cleanup finished!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

completeCleanup();
