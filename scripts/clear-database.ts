import { PrismaClient } from '@prisma/client';
import { clearDatabaseFull } from './lib/clear-database-full';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Clearing database (full)...\n');
  try {
    await clearDatabaseFull(prisma);
    console.log('\n✅ Database cleared successfully!');
    console.log('\n📋 Next: npm run seed:belarus');
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
