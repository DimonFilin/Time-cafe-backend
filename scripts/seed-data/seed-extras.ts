import {
  ActivityAction,
  ActivityCategory,
  DocumentType,
  LogSeverity,
  PrismaClient,
  TaskAssignmentType,
  TaskCategory,
  TaskPriority,
  WorkerRole,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import type { SeedContext } from './types';

export async function seedExtras(
  prisma: PrismaClient,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n📋 Tasks, docs, activity logs...');

  const cafes = Object.values(ctx.cafes);

  for (const cafe of cafes) {
    const admin =
      cafe.id === ctx.cafes.minskOktyabrskaya.id
        ? ctx.workers.minsk2Admin
        : cafe.id === ctx.cafes.brestCenter.id
          ? ctx.workers.brestAdmin
          : ctx.workers.multiacc[2];

    const worker =
      cafe.id === ctx.cafes.minskOktyabrskaya.id
        ? ctx.workers.minsk2Worker
        : cafe.id === ctx.cafes.brestCenter.id
          ? ctx.workers.brestWorker
          : ctx.workers.multiacc[3];

    const template = await prisma.taskTemplate.create({
      data: {
        cafeId: cafe.id,
        title: 'Открытие смены',
        description: 'Проверить зал и кассу',
        category: TaskCategory.OPENING,
        priority: TaskPriority.HIGH,
        assignmentType: TaskAssignmentType.ROLE_BASED,
        assignedRoles: [WorkerRole.WORKER],
        assignedWorkerIds: [],
        daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
        createdById: admin.id,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.taskCompletion.create({
      data: {
        templateId: template.id,
        workerId: worker.id,
        completionDate: today,
        comment: 'Готово',
        durationMinutes: 15,
      },
    });

    const brandId =
      cafe.brandId === ctx.brands.timeCafeBy.id
        ? ctx.brands.timeCafeBy.id
        : ctx.brands.uyutnyChas.id;

    await prisma.brandDocument.create({
      data: {
        brandId,
        type: DocumentType.LICENSE,
        name: 'Лицензия',
        fileUrl:
          'https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf',
        fileType: 'application/pdf',
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    const rawKey = randomBytes(24).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    await prisma.brandApiKey.create({
      data: {
        brandId,
        name: 'Demo integration',
        keyHash,
        prefix: rawKey.slice(0, 8),
        permissions: ['read:cafes'],
        isActive: true,
      },
    });

    for (const [i, action] of [
      ActivityAction.LOGIN,
      ActivityAction.VIEW_LIST,
      ActivityAction.UPDATE,
    ].entries()) {
      await prisma.activityLog.create({
        data: {
          workerId: admin.id,
          workerEmail: admin.email,
          workerRole: admin.role,
          brandId,
          cafeId: cafe.id,
          action,
          category:
            action === ActivityAction.LOGIN
              ? ActivityCategory.AUTH
              : ActivityCategory.DATA,
          severity: LogSeverity.INFO,
          resourceType: 'cafe',
          resourceId: cafe.id,
          details: { step: i + 1 },
          endpoint: '/api/demo',
          method: 'GET',
          statusCode: 200,
        },
      });
    }
  }
}
