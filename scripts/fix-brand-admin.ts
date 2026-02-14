import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixBrandAdmin() {
  console.log('🔧 Fixing Brand Admin worker accounts...\n');

  try {
    // Get all brands
    const brands = await prisma.brand.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log('📋 Available Brands:');
    brands.forEach((brand, index) => {
      console.log(`   ${index + 1}. ${brand.name} (ID: ${brand.id})`);
    });

    if (brands.length === 0) {
      console.error('\n❌ No brands found in database!');
      console.log('   Run "npm run seed" to create test data');
      return;
    }

    // Use first brand (should be Coffee House)
    const targetBrand = brands[0];
    console.log(`\n✓ Using brand: ${targetBrand.name}\n`);

    // Get all BRAND_ADMIN accounts for multiacc.email@gmail.com
    const brandAdmins = await prisma.workerAccount.findMany({
      where: {
        email: 'multiacc.email@gmail.com',
        role: 'BRAND_ADMIN',
      },
    });

    console.log(
      `Found ${brandAdmins.length} BRAND_ADMIN accounts for multiacc.email@gmail.com`,
    );

    if (brandAdmins.length === 0) {
      console.error('\n❌ No BRAND_ADMIN accounts found!');
      return;
    }

    // Update all BRAND_ADMIN accounts to have the correct brand
    for (const admin of brandAdmins) {
      const oldBrandId = admin.brandId;

      if (oldBrandId === targetBrand.id) {
        console.log(`✓ Account ${admin.id} already has correct brand`);
        continue;
      }

      await prisma.workerAccount.update({
        where: { id: admin.id },
        data: {
          brandId: targetBrand.id,
          cafeId: null, // BRAND_ADMIN should not have cafeId
        },
      });

      console.log(`✓ Updated account ${admin.id}`);
      console.log(`  Old Brand ID: ${oldBrandId || 'N/A'}`);
      console.log(`  New Brand ID: ${targetBrand.id}`);
    }

    // Also fix CAFE_ADMIN to use the same brand
    const cafeAdmins = await prisma.workerAccount.findMany({
      where: {
        email: 'multiacc.email@gmail.com',
        role: 'CAFE_ADMIN',
      },
    });

    console.log(
      `\nFound ${cafeAdmins.length} CAFE_ADMIN accounts for multiacc.email@gmail.com`,
    );

    for (const admin of cafeAdmins) {
      // Get a cafe from the target brand
      const cafe = await prisma.cafe.findFirst({
        where: {
          brandId: targetBrand.id,
        },
      });

      if (!cafe) {
        console.warn(`⚠️  No cafe found for brand ${targetBrand.name}`);
        continue;
      }

      await prisma.workerAccount.update({
        where: { id: admin.id },
        data: {
          brandId: targetBrand.id,
          cafeId: cafe.id,
        },
      });

      console.log(`✓ Updated CAFE_ADMIN account ${admin.id}`);
      console.log(`  Brand: ${targetBrand.name}`);
      console.log(`  Cafe: ${cafe.name}`);
    }

    // Show final state
    console.log('\n📊 Final State:');
    const finalAccounts = await prisma.workerAccount.findMany({
      where: {
        email: 'multiacc.email@gmail.com',
      },
      include: {
        brand: {
          select: {
            name: true,
          },
        },
        cafe: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        role: 'asc',
      },
    });

    finalAccounts.forEach((account, index) => {
      console.log(
        `\n   ${index + 1}. ${account.firstName} ${account.lastName}`,
      );
      console.log(`      Role: ${account.role}`);
      console.log(`      Brand: ${account.brand?.name || 'N/A'}`);
      console.log(`      Cafe: ${account.cafe?.name || 'N/A'}`);
    });

    console.log('\n✅ Brand Admin accounts fixed!');
    console.log('\n🎯 Now you can login and select BRAND_ADMIN role');
    console.log('   It will show cafes from:', targetBrand.name);
  } catch (error) {
    console.error('❌ Error fixing brand admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void fixBrandAdmin();
