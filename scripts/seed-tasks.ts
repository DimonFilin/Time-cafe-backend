import {
  PrismaClient,
  TaskCategory,
  TaskPriority,
  TaskAssignmentType,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting tasks seed...\n');

  try {
    // Find worker with multiacc.email@gmail.com or any worker
    let worker = await prisma.workerAccount.findFirst({
      where: {
        email: 'multiacc.email@gmail.com',
        role: 'WORKER',
      },
      include: {
        cafe: true,
      },
    });

    // If not found, try to find any worker with a cafe
    if (!worker) {
      console.log('⚠️  Worker with multiacc.email@gmail.com not found');
      console.log('   Looking for any worker with assigned cafe...\n');

      worker = await prisma.workerAccount.findFirst({
        where: {
          role: 'WORKER',
          cafeId: { not: null },
        },
        include: {
          cafe: true,
        },
      });

      if (!worker) {
        console.error('❌ No workers with assigned cafe found');
        console.log('   Run seed-database.ts first to create test users');
        console.log(
          '   Or run assign-worker-to-cafe.ts to assign existing worker to cafe',
        );
        process.exit(1);
      }
    }

    console.log(
      `✓ Found worker: ${worker.firstName} ${worker.lastName} (${worker.email})`,
    );
    console.log(`✓ Cafe: ${worker.cafe?.name || 'Unknown'}`);
    console.log(`✓ Cafe ID: ${worker.cafeId}\n`);

    if (!worker.cafeId) {
      console.error('❌ Worker is not assigned to any cafe');
      console.log('   Run assign-worker-to-cafe.ts to assign worker to cafe');
      process.exit(1);
    }

    // Find cafe admin to use as creator - prefer same email, fallback to any cafe admin
    let cafeAdmin = await prisma.workerAccount.findFirst({
      where: {
        email: worker.email,
        role: 'CAFE_ADMIN',
      },
    });

    if (!cafeAdmin) {
      console.log('⚠️  Cafe admin with same email not found');
      console.log('   Looking for any cafe admin...\n');

      cafeAdmin = await prisma.workerAccount.findFirst({
        where: {
          role: 'CAFE_ADMIN',
        },
      });

      if (!cafeAdmin) {
        console.error('❌ No cafe admin found');
        console.log('   Tasks need to be created by a cafe admin');
        process.exit(1);
      }
    }

    console.log(
      `✓ Found cafe admin as creator: ${cafeAdmin.firstName} ${cafeAdmin.lastName} (${cafeAdmin.email})\n`,
    );

    // Delete existing tasks for this cafe
    console.log('🗑️  Cleaning up existing tasks...');
    await prisma.taskCompletion.deleteMany({
      where: {
        template: {
          cafeId: worker.cafeId,
        },
      },
    });
    await prisma.taskTemplate.deleteMany({
      where: {
        cafeId: worker.cafeId,
      },
    });
    console.log('✓ Cleanup complete\n');

    // All days of week (0 = Sunday, 6 = Saturday)
    const allDays = [0, 1, 2, 3, 4, 5, 6];

    // Task configurations to create
    const taskConfigs = [
      // OPENING tasks
      {
        category: TaskCategory.OPENING,
        priority: TaskPriority.HIGH,
        requiresPhoto: false,
        requiresComment: false,
        title: 'Открыть кафе и включить свет',
        description:
          'Открыть входную дверь, включить все освещение в зале и на кухне',
        estimatedMinutes: 5,
      },
      {
        category: TaskCategory.OPENING,
        priority: TaskPriority.HIGH,
        requiresPhoto: true,
        requiresComment: false,
        title: 'Проверить чистоту зала',
        description:
          'Осмотреть зал, сфотографировать общий вид. Все столы должны быть чистыми',
        estimatedMinutes: 10,
      },
      {
        category: TaskCategory.OPENING,
        priority: TaskPriority.MEDIUM,
        requiresPhoto: false,
        requiresComment: true,
        title: 'Проверить запасы продуктов',
        description:
          'Проверить наличие основных продуктов, записать что нужно докупить',
        estimatedMinutes: 15,
      },
      {
        category: TaskCategory.OPENING,
        priority: TaskPriority.LOW,
        requiresPhoto: true,
        requiresComment: true,
        title: 'Подготовить витрину с выпечкой',
        description:
          'Выложить свежую выпечку, сфотографировать витрину, указать что выложено',
        estimatedMinutes: 20,
      },

      // SHIFT tasks
      {
        category: TaskCategory.SHIFT,
        priority: TaskPriority.HIGH,
        requiresPhoto: false,
        requiresComment: false,
        title: 'Проверить температуру холодильников',
        description:
          'Проверить температуру во всех холодильниках (должна быть 2-6°C)',
        estimatedMinutes: 5,
      },
      {
        category: TaskCategory.SHIFT,
        priority: TaskPriority.HIGH,
        requiresPhoto: true,
        requiresComment: false,
        title: 'Проверить состояние туалетов',
        description:
          'Проверить чистоту и наличие расходников в туалетах, сфотографировать',
        estimatedMinutes: 10,
      },
      {
        category: TaskCategory.SHIFT,
        priority: TaskPriority.MEDIUM,
        requiresPhoto: false,
        requiresComment: true,
        title: 'Обработать жалобы клиентов',
        description: 'Если были жалобы, описать ситуацию и принятые меры',
        estimatedMinutes: 15,
      },
      {
        category: TaskCategory.SHIFT,
        priority: TaskPriority.LOW,
        requiresPhoto: true,
        requiresComment: true,
        title: 'Обновить меню на доске',
        description:
          'Обновить специальные предложения на доске, сфотографировать, описать изменения',
        estimatedMinutes: 20,
      },

      // CLOSING tasks
      {
        category: TaskCategory.CLOSING,
        priority: TaskPriority.HIGH,
        requiresPhoto: false,
        requiresComment: false,
        title: 'Закрыть кассу и сверить выручку',
        description:
          'Закрыть смену в кассе, сверить фактическую выручку с данными системы',
        estimatedMinutes: 15,
      },
      {
        category: TaskCategory.CLOSING,
        priority: TaskPriority.HIGH,
        requiresPhoto: true,
        requiresComment: false,
        title: 'Проверить чистоту кухни',
        description:
          'Убедиться что кухня чисто убрана, сфотографировать рабочие поверхности',
        estimatedMinutes: 10,
      },
      {
        category: TaskCategory.CLOSING,
        priority: TaskPriority.MEDIUM,
        requiresPhoto: false,
        requiresComment: true,
        title: 'Записать остатки продуктов',
        description:
          'Подсчитать остатки скоропортящихся продуктов, записать количество',
        estimatedMinutes: 20,
      },
      {
        category: TaskCategory.CLOSING,
        priority: TaskPriority.LOW,
        requiresPhoto: true,
        requiresComment: true,
        title: 'Проверить состояние оборудования',
        description:
          'Осмотреть все оборудование, сфотографировать, описать выявленные проблемы',
        estimatedMinutes: 15,
      },

      // GENERAL tasks
      {
        category: TaskCategory.GENERAL,
        priority: TaskPriority.HIGH,
        requiresPhoto: false,
        requiresComment: false,
        title: 'Проверить срок годности продуктов',
        description: 'Проверить даты на всех продуктах, убрать просроченные',
        estimatedMinutes: 20,
      },
      {
        category: TaskCategory.GENERAL,
        priority: TaskPriority.HIGH,
        requiresPhoto: true,
        requiresComment: false,
        title: 'Провести уборку зала',
        description:
          'Протереть все столы, подмести пол, сфотографировать результат',
        estimatedMinutes: 30,
      },
      {
        category: TaskCategory.GENERAL,
        priority: TaskPriority.MEDIUM,
        requiresPhoto: false,
        requiresComment: true,
        title: 'Обучить нового сотрудника',
        description:
          'Провести инструктаж для нового сотрудника, описать что было изучено',
        estimatedMinutes: 60,
      },
      {
        category: TaskCategory.GENERAL,
        priority: TaskPriority.LOW,
        requiresPhoto: true,
        requiresComment: true,
        title: 'Обновить декор в зале',
        description:
          'Обновить сезонный декор, сфотографировать, описать что изменилось',
        estimatedMinutes: 45,
      },
    ];

    console.log(`📝 Creating ${taskConfigs.length} task templates...\n`);

    let createdCount = 0;
    for (const config of taskConfigs) {
      await prisma.taskTemplate.create({
        data: {
          cafeId: worker.cafeId,
          title: config.title,
          description: config.description,
          category: config.category,
          priority: config.priority,
          requiresPhoto: config.requiresPhoto,
          requiresComment: config.requiresComment,
          estimatedMinutes: config.estimatedMinutes,
          assignmentType: TaskAssignmentType.ALL_WORKERS,
          assignedWorkerIds: [],
          assignedRoles: [],
          isActive: true,
          daysOfWeek: allDays,
          createdById: cafeAdmin.id,
        },
      });

      createdCount++;
      const photoIcon = config.requiresPhoto ? '📷' : '  ';
      const commentIcon = config.requiresComment ? '💬' : '  ';
      const priorityIcon =
        config.priority === TaskPriority.HIGH
          ? '🔴'
          : config.priority === TaskPriority.MEDIUM
            ? '🟡'
            : '🟢';

      console.log(
        `   ${priorityIcon} ${photoIcon} ${commentIcon} [${config.category}] ${config.title}`,
      );
    }

    console.log(`\n✅ Created ${createdCount} task templates successfully!\n`);

    // Summary by category
    const summary = {
      OPENING: taskConfigs.filter((t) => t.category === TaskCategory.OPENING)
        .length,
      SHIFT: taskConfigs.filter((t) => t.category === TaskCategory.SHIFT)
        .length,
      CLOSING: taskConfigs.filter((t) => t.category === TaskCategory.CLOSING)
        .length,
      GENERAL: taskConfigs.filter((t) => t.category === TaskCategory.GENERAL)
        .length,
    };

    console.log('📊 Summary by category:');
    console.log(`   OPENING: ${summary.OPENING} tasks`);
    console.log(`   SHIFT: ${summary.SHIFT} tasks`);
    console.log(`   CLOSING: ${summary.CLOSING} tasks`);
    console.log(`   GENERAL: ${summary.GENERAL} tasks`);

    console.log('\n📊 Summary by requirements:');
    const withPhoto = taskConfigs.filter(
      (t) => t.requiresPhoto && !t.requiresComment,
    ).length;
    const withComment = taskConfigs.filter(
      (t) => !t.requiresPhoto && t.requiresComment,
    ).length;
    const withBoth = taskConfigs.filter(
      (t) => t.requiresPhoto && t.requiresComment,
    ).length;
    const withNone = taskConfigs.filter(
      (t) => !t.requiresPhoto && !t.requiresComment,
    ).length;

    console.log(`   No requirements: ${withNone} tasks`);
    console.log(`   Photo only: ${withPhoto} tasks`);
    console.log(`   Comment only: ${withComment} tasks`);
    console.log(`   Photo + Comment: ${withBoth} tasks`);

    console.log('\n📊 Summary by priority:');
    const high = taskConfigs.filter(
      (t) => t.priority === TaskPriority.HIGH,
    ).length;
    const medium = taskConfigs.filter(
      (t) => t.priority === TaskPriority.MEDIUM,
    ).length;
    const low = taskConfigs.filter(
      (t) => t.priority === TaskPriority.LOW,
    ).length;

    console.log(`   HIGH: ${high} tasks`);
    console.log(`   MEDIUM: ${medium} tasks`);
    console.log(`   LOW: ${low} tasks`);

    console.log('\n✅ Tasks seed completed successfully!');
    console.log('\n📋 Test Instructions:');
    console.log(
      `   1. Login as worker: ${worker.email} / (check password in seed script)`,
    );
    console.log('   2. Navigate to Tasks tab in worker dashboard');
    console.log('   3. You should see all 16 tasks for today');
    console.log('   4. Test completing tasks with different requirements:');
    console.log('      - Tasks without requirements (direct completion)');
    console.log('      - Tasks with photo requirement (upload modal)');
    console.log('      - Tasks with comment requirement (comment modal)');
    console.log('      - Tasks with both requirements (photo then comment)');
    console.log(
      '   5. Test category filtering (OPENING, SHIFT, CLOSING, GENERAL)',
    );
    console.log('   6. Test uncompleting tasks');
    console.log('   7. Verify auto-refresh works (30 seconds)\n');
  } catch (error) {
    console.error('❌ Error seeding tasks:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
