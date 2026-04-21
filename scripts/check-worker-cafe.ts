import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workerId = 'd9f22e22-8e77-4a6e-a2e5-d6b4ac553738';

  console.log('Checking worker:', workerId);

  const worker = await prisma.workerAccount.findUnique({
    where: { id: workerId },
    include: {
      cafe: true,
      brand: true,
    },
  });

  if (!worker) {
    console.log('Worker not found!');
    return;
  }

  console.log('\nWorker data:');
  console.log('- ID:', worker.id);
  console.log('- Email:', worker.email);
  console.log('- Name:', worker.firstName, worker.lastName);
  console.log('- Role:', worker.role);
  console.log('- CafeId:', worker.cafeId);
  console.log('- BrandId:', worker.brandId);

  if (worker.cafe) {
    console.log('\nCafe data:');
    console.log('- ID:', worker.cafe.id);
    console.log('- Name:', worker.cafe.name);
    console.log('- Address:', worker.cafe.address);
    console.log('- DeletedAt:', worker.cafe.deletedAt);
  } else {
    console.log('\n❌ Cafe is NULL - worker is not assigned to any cafe!');
  }

  if (worker.brand) {
    console.log('\nBrand data:');
    console.log('- ID:', worker.brand.id);
    console.log('- Name:', worker.brand.name);
    console.log('- Status:', worker.brand.status);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
