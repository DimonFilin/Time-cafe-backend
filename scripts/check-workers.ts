import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking workers...\n');

  const workers = await prisma.workerAccount.findMany({
    include: {
      cafe: true,
      brand: true,
    },
    orderBy: {
      email: 'asc',
    },
  });

  console.log(`Found ${workers.length} workers:\n`);

  for (const worker of workers) {
    console.log(`📧 ${worker.email}`);
    console.log(`   Role: ${worker.role}`);
    console.log(`   Name: ${worker.firstName} ${worker.lastName}`);
    console.log(`   Brand: ${worker.brand?.name || 'None'}`);
    console.log(`   Cafe: ${worker.cafe?.name || 'None'}`);
    console.log(`   CafeId: ${worker.cafeId || 'None'}`);
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
