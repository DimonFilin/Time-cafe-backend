import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cafeId = '2d1789c8-cd2a-44f0-8734-6ede33b8e003';

  console.log('🔍 Checking tasks for cafe:', cafeId);

  const tasks = await prisma.taskTemplate.findMany({
    where: {
      cafeId,
    },
    orderBy: [{ category: 'asc' }, { priority: 'desc' }],
  });

  console.log(`\n✅ Found ${tasks.length} tasks:\n`);

  const byCategory = {
    OPENING: tasks.filter((t) => t.category === 'OPENING'),
    SHIFT: tasks.filter((t) => t.category === 'SHIFT'),
    CLOSING: tasks.filter((t) => t.category === 'CLOSING'),
    GENERAL: tasks.filter((t) => t.category === 'GENERAL'),
  };

  for (const [category, categoryTasks] of Object.entries(byCategory)) {
    console.log(`\n📋 ${category} (${categoryTasks.length} tasks):`);
    for (const task of categoryTasks) {
      const photoIcon = task.requiresPhoto ? '📷' : '  ';
      const commentIcon = task.requiresComment ? '💬' : '  ';
      const priorityIcon =
        task.priority === 'HIGH'
          ? '🔴'
          : task.priority === 'MEDIUM'
            ? '🟡'
            : '🟢';
      console.log(
        `   ${priorityIcon} ${photoIcon} ${commentIcon} ${task.title}`,
      );
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Total: ${tasks.length} tasks`);
  console.log(`   OPENING: ${byCategory.OPENING.length}`);
  console.log(`   SHIFT: ${byCategory.SHIFT.length}`);
  console.log(`   CLOSING: ${byCategory.CLOSING.length}`);
  console.log(`   GENERAL: ${byCategory.GENERAL.length}`);

  const withPhoto = tasks.filter(
    (t) => t.requiresPhoto && !t.requiresComment,
  ).length;
  const withComment = tasks.filter(
    (t) => !t.requiresPhoto && t.requiresComment,
  ).length;
  const withBoth = tasks.filter(
    (t) => t.requiresPhoto && t.requiresComment,
  ).length;
  const withNone = tasks.filter(
    (t) => !t.requiresPhoto && !t.requiresComment,
  ).length;

  console.log('\n📊 By requirements:');
  console.log(`   No requirements: ${withNone}`);
  console.log(`   Photo only: ${withPhoto}`);
  console.log(`   Comment only: ${withComment}`);
  console.log(`   Photo + Comment: ${withBoth}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
