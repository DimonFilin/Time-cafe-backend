import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workerId = 'df703cf3-8bb8-418a-baec-864c44dbdbaf';

  console.log('🔍 Проверяем работника...\n');

  // Получаем информацию о работнике
  const worker = await prisma.workerAccount.findUnique({
    where: { id: workerId },
    include: {
      brand: true,
      cafe: true,
    },
  });

  if (!worker) {
    console.error('❌ Работник не найден!');
    return;
  }

  console.log('👤 Информация о работнике:');
  console.log('ID:', worker.id);
  console.log('Email:', worker.email);
  console.log('Имя:', worker.firstName, worker.lastName);
  console.log('Роль:', worker.role);
  console.log('Brand ID:', worker.brandId || 'НЕ НАЗНАЧЕН');
  console.log('Cafe ID:', worker.cafeId || 'НЕ НАЗНАЧЕН');

  if (worker.brand) {
    console.log('Бренд:', worker.brand.name);
  }

  if (worker.cafe) {
    console.log('Кафе:', worker.cafe.name);
  }

  console.log('\n📋 Доступные кафе:');

  // Получаем все кафе
  const cafes = await prisma.cafe.findMany({
    include: {
      brand: true,
    },
    take: 10,
  });

  if (cafes.length === 0) {
    console.log('❌ Нет доступных кафе в базе!');
    console.log('\n💡 Сначала создайте кафе через seed скрипт или админку');
    return;
  }

  cafes.forEach((cafe, index) => {
    console.log(`${index + 1}. ${cafe.name} (ID: ${cafe.id})`);
    console.log(`   Бренд: ${cafe.brand.name}`);
    console.log(`   Адрес: ${cafe.address}`);
  });

  // Если у работника есть brandId, показываем только кафе этого бренда
  if (worker.brandId) {
    console.log('\n🏢 Кафе бренда работника:');
    const brandCafes = cafes.filter((c) => c.brandId === worker.brandId);

    if (brandCafes.length === 0) {
      console.log('❌ У бренда работника нет кафе!');
      return;
    }

    brandCafes.forEach((cafe, index) => {
      console.log(`${index + 1}. ${cafe.name} (ID: ${cafe.id})`);
    });

    // Автоматически назначаем первое кафе бренда
    const firstCafe = brandCafes[0];
    console.log(`\n✅ Назначаем работника в кафе: ${firstCafe.name}`);

    await prisma.workerAccount.update({
      where: { id: workerId },
      data: {
        cafeId: firstCafe.id,
      },
    });

    console.log('✅ Работник успешно назначен в кафе!');
  } else {
    // Если нет brandId, назначаем первое доступное кафе
    const firstCafe = cafes[0];
    console.log(`\n✅ Назначаем работника в кафе: ${firstCafe.name}`);
    console.log(`   И в бренд: ${firstCafe.brand.name}`);

    await prisma.workerAccount.update({
      where: { id: workerId },
      data: {
        cafeId: firstCafe.id,
        brandId: firstCafe.brandId,
      },
    });

    console.log('✅ Работник успешно назначен в кафе и бренд!');
  }

  // Проверяем результат
  const updatedWorker = await prisma.workerAccount.findUnique({
    where: { id: workerId },
    include: {
      brand: true,
      cafe: true,
    },
  });

  console.log('\n✅ Обновленная информация:');
  console.log('Brand ID:', updatedWorker?.brandId);
  console.log('Бренд:', updatedWorker?.brand?.name);
  console.log('Cafe ID:', updatedWorker?.cafeId);
  console.log('Кафе:', updatedWorker?.cafe?.name);
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
