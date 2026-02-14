import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBrand() {
  console.log('🔍 Checking brand association...\n');

  try {
    const workerId = 'd665b391-9bc3-4c73-8cd2-7738b7ea0bd8';
    const brandId = '9d77907e-3353-4ac4-99ce-47865969f7a4';

    // Check worker account
    const worker = await prisma.workerAccount.findUnique({
      where: { id: workerId },
      include: {
        brand: true,
        cafe: true,
      },
    });

    console.log('👤 Worker Account:');
    console.log(`   ID: ${worker?.id}`);
    console.log(`   Email: ${worker?.email}`);
    console.log(`   Role: ${worker?.role}`);
    console.log(`   Brand ID: ${worker?.brandId}`);
    console.log(`   Cafe ID: ${worker?.cafeId}`);
    console.log('');

    if (worker?.brand) {
      console.log('✅ Brand found in worker.brand:');
      console.log(`   ID: ${worker.brand.id}`);
      console.log(`   Name: ${worker.brand.name}`);
      console.log(`   Status: ${worker.brand.status}`);
      console.log(`   Deleted: ${worker.brand.deletedAt ? 'YES' : 'NO'}`);
    } else {
      console.log('❌ Brand NOT found in worker.brand');
    }
    console.log('');

    // Check if brand exists directly
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (brand) {
      console.log('✅ Brand exists in database:');
      console.log(`   ID: ${brand.id}`);
      console.log(`   Name: ${brand.name}`);
      console.log(`   Status: ${brand.status}`);
      console.log(`   Deleted: ${brand.deletedAt ? 'YES' : 'NO'}`);
    } else {
      console.log('❌ Brand NOT found in database!');
      console.log(`   Looking for ID: ${brandId}`);
    }
    console.log('');

    // List all brands
    const allBrands = await prisma.brand.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        status: true,
        deletedAt: true,
      },
    });

    console.log('📋 All active brands in database:');
    allBrands.forEach((b, index) => {
      console.log(`   ${index + 1}. ${b.name}`);
      console.log(`      ID: ${b.id}`);
      console.log(`      Status: ${b.status}`);
      console.log(`      Match: ${b.id === brandId ? '✅ YES' : '❌ NO'}`);
      console.log('');
    });

    // Check cafes for this brand
    const cafes = await prisma.cafe.findMany({
      where: {
        brandId: brandId,
        deletedAt: null,
      },
    });

    console.log(`☕ Cafes for brand ${brandId}:`);
    console.log(`   Found: ${cafes.length} cafes`);
    cafes.forEach((cafe, index) => {
      console.log(`   ${index + 1}. ${cafe.name} (${cafe.city})`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

void checkBrand();
