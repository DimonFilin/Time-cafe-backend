import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workerId = 'df703cf3-8bb8-418a-baec-864c44dbdbaf';

  // Получаем работника
  const worker = await prisma.workerAccount.findUnique({
    where: { id: workerId },
    include: {
      brand: true,
    },
  });

  if (!worker) {
    console.error('❌ Работник не найден!');
    return;
  }

  console.log('👤 Работник:', worker.email);
  console.log('Роль:', worker.role);
  console.log('Brand ID:', worker.brandId);

  if (worker.brand) {
    console.log('Бренд:', worker.brand.name);

    // Ищем кафе этого бренда
    console.log('\n🏢 Кафе бренда "' + worker.brand.name + '":');
    const brandCafes = await prisma.cafe.findMany({
      where: {
        brandId: worker.brandId!,
      },
    });

    if (brandCafes.length === 0) {
      console.log('❌ У бренда нет кафе!');
      console.log('\n💡 Варианты решения:');
      console.log('1. Создать кафе для бренда "Time Cafe"');
      console.log(
        '2. Назначить работника в другой бренд, у которого есть кафе',
      );

      // Показываем бренды с кафе
      console.log('\n📋 Бренды с кафе:');
      const brandsWithCafes = await prisma.brand.findMany({
        include: {
          cafes: true,
        },
      });

      brandsWithCafes.forEach((brand) => {
        if (brand.cafes.length > 0) {
          console.log(`\n${brand.name} (ID: ${brand.id})`);
          brand.cafes.forEach((cafe) => {
            console.log(`  - ${cafe.name} (ID: ${cafe.id})`);
          });
        }
      });

      // Предлагаем назначить в первый бренд с кафе
      const firstBrandWithCafes = brandsWithCafes.find(
        (b) => b.cafes.length > 0,
      );
      if (firstBrandWithCafes) {
        console.log(
          '\n✅ Назначаем работника в бренд "' + firstBrandWithCafes.name + '"',
        );
        console.log('   И в кафе "' + firstBrandWithCafes.cafes[0].name + '"');

        await prisma.workerAccount.update({
          where: { id: workerId },
          data: {
            brandId: firstBrandWithCafes.id,
            cafeId: firstBrandWithCafes.cafes[0].id,
          },
        });

        console.log('✅ Готово!');
      }
    } else {
      console.log('✅ Найдено кафе:', brandCafes.length);
      brandCafes.forEach((cafe) => {
        console.log(`  - ${cafe.name} (ID: ${cafe.id})`);
      });

      // Назначаем в первое кафе
      console.log(
        '\n✅ Назначаем работника в кафе "' + brandCafes[0].name + '"',
      );
      await prisma.workerAccount.update({
        where: { id: workerId },
        data: {
          cafeId: brandCafes[0].id,
        },
      });

      console.log('✅ Готово!');
    }
  }

  // Проверяем результат
  const updatedWorker = await prisma.workerAccount.findUnique({
    where: { id: workerId },
    include: {
      brand: true,
      cafe: true,
    },
  });

  console.log('\n✅ Финальная информация:');
  console.log('Бренд:', updatedWorker?.brand?.name);
  console.log('Кафе:', updatedWorker?.cafe?.name);
  console.log('Cafe ID:', updatedWorker?.cafeId);
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
