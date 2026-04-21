import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const brandId = '8ba7f732-a6f1-4528-b6a7-ac9fb1310c5f';

  console.log('Checking cafes for brand:', brandId);

  const cafes = await prisma.cafe.findMany({
    where: {
      brandId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      deletedAt: true,
    },
  });

  console.log(`\nFound ${cafes.length} cafes:\n`);

  cafes.forEach((cafe, index) => {
    console.log(`${index + 1}. ${cafe.name}`);
    console.log(`   ID: ${cafe.id}`);
    console.log(`   Address: ${cafe.address}, ${cafe.city}`);
    console.log(`   Deleted: ${cafe.deletedAt ? 'YES' : 'NO'}`);
    console.log('');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
