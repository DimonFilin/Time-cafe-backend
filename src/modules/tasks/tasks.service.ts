import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  CreateTaskTemplateDto,
  UpdateTaskTemplateDto,
  TaskTemplateResponseDto,
  CompleteTaskDto,
  WorkerTasksResponseDto,
  WorkerTaskDto,
  TaskStatisticsResponseDto,
  TaskCompletionHistoryResponseDto,
} from './dto';
import {
  TaskAssignmentType,
  TaskTemplate,
  ActivityAction,
  ActivityCategory,
  Prisma,
  WorkerRole,
} from '@prisma/client';

interface TaskTemplateWithRelations extends TaskTemplate {
  createdBy?: {
    firstName: string;
    lastName: string;
  } | null;
}

/** Parse YYYY-MM-DD as local calendar date (avoids UTC shift on date-only strings). */
function parseDateYmd(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** daysOfWeek in DB/API: 1=Mon … 7=Sun */
function dayOfWeekIso(date: string): number {
  const jsDay = parseDateYmd(date).getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function dateRangeYmd(
  fromDate: string,
  toDate: string,
): { gte: Date; lte: Date } {
  const gte = parseDateYmd(fromDate);
  const lte = parseDateYmd(toDate);
  lte.setHours(23, 59, 59, 999);
  return { gte, lte };
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  // Get worker by keycloakId
  async getWorkerByKeycloakId(keycloakId: string) {
    return this.prisma.workerAccount.findFirst({
      where: {
        keycloakId,
        deletedAt: null,
      },
    });
  }

  // Get worker by ID
  async getWorkerById(workerId: string) {
    return this.prisma.workerAccount.findUnique({
      where: {
        id: workerId,
      },
    });
  }

  // TODO: TEMPORARY - for testing only
  async getAllWorkers() {
    return this.prisma.workerAccount.findMany({
      where: {
        deletedAt: null,
      },
    });
  }

  // Helper to convert null to undefined
  private nullToUndefined<T>(value: T | null): T | undefined {
    return value === null ? undefined : value;
  }

  // Helper to map template to response DTO
  private mapTemplateToDto(
    template: TaskTemplateWithRelations,
  ): TaskTemplateResponseDto {
    return {
      ...template,
      description: this.nullToUndefined(template.description),
      estimatedMinutes: this.nullToUndefined(template.estimatedMinutes),
    };
  }

  // Helper method to log activity
  private async logActivity(
    workerId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    cafeId: string,
    details: Record<string, unknown>,
    category: ActivityCategory = ActivityCategory.DATA,
  ) {
    try {
      const worker = await this.prisma.workerAccount.findUnique({
        where: { id: workerId },
        select: { email: true, role: true },
      });

      if (worker) {
        await this.activityLogs.log({
          workerId,
          workerEmail: worker.email,
          workerRole: worker.role,
          action: action as ActivityAction,
          category,
          resourceType,
          resourceId,
          cafeId,
          details: details as Prisma.InputJsonValue,
        });
      }
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to log activity:', error);
    }
  }

  // ============================================
  // Template CRUD Methods
  // ============================================

  async createTemplate(
    cafeId: string,
    createdById: string,
    dto: CreateTaskTemplateDto,
  ): Promise<TaskTemplateResponseDto> {
    // Validate cafe exists
    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
    });

    if (!cafe) {
      throw new NotFoundException('Cafe not found');
    }

    // Validate assignment type requirements
    if (
      dto.assignmentType === TaskAssignmentType.SPECIFIC_WORKERS &&
      (!dto.assignedWorkerIds || dto.assignedWorkerIds.length === 0)
    ) {
      throw new BadRequestException(
        'assignedWorkerIds is required for SPECIFIC_WORKERS assignment type',
      );
    }

    if (
      dto.assignmentType === TaskAssignmentType.ROLE_BASED &&
      (!dto.assignedRoles || dto.assignedRoles.length === 0)
    ) {
      throw new BadRequestException(
        'assignedRoles is required for ROLE_BASED assignment type',
      );
    }

    // Create template
    const template = await this.prisma.taskTemplate.create({
      data: {
        cafeId,
        createdById,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: dto.priority,
        requiresPhoto: dto.requiresPhoto ?? false,
        requiresComment: dto.requiresComment ?? false,
        estimatedMinutes: dto.estimatedMinutes,
        assignmentType: dto.assignmentType,
        assignedWorkerIds: dto.assignedWorkerIds ?? [],
        assignedRoles: dto.assignedRoles ?? [],
        daysOfWeek: dto.daysOfWeek ?? [],
        isActive: true,
      },
    });

    // Log activity
    await this.logActivity(
      createdById,
      'CREATE',
      'TASK_TEMPLATE',
      template.id,
      cafeId,
      {
        title: template.title,
        category: template.category,
        priority: template.priority,
      },
    );

    return this.mapTemplateToDto(template);
  }

  async getTemplates(
    cafeId: string,
    includeInactive = false,
    actorWorkerId?: string,
  ): Promise<TaskTemplateResponseDto[]> {
    const templates = await this.prisma.taskTemplate.findMany({
      where: {
        cafeId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ category: 'asc' }, { priority: 'desc' }, { title: 'asc' }],
    });

    if (actorWorkerId) {
      await this.logActivity(
        actorWorkerId,
        'VIEW_LIST',
        'TASK_TEMPLATE',
        cafeId,
        cafeId,
        { includeInactive },
        ActivityCategory.VIEW,
      );
    }

    return templates.map((t) => this.mapTemplateToDto(t));
  }

  async getTemplateById(
    id: string,
    cafeId: string,
  ): Promise<TaskTemplateResponseDto> {
    const template = await this.prisma.taskTemplate.findFirst({
      where: {
        id,
        cafeId,
      },
    });

    if (!template) {
      throw new NotFoundException('Task template not found');
    }

    return this.mapTemplateToDto(template);
  }

  async updateTemplate(
    id: string,
    cafeId: string,
    workerId: string,
    dto: UpdateTaskTemplateDto,
  ): Promise<TaskTemplateResponseDto> {
    // Verify template exists and belongs to cafe
    await this.getTemplateById(id, cafeId);

    // Validate assignment type requirements if being updated
    if (
      dto.assignmentType === TaskAssignmentType.SPECIFIC_WORKERS &&
      dto.assignedWorkerIds &&
      dto.assignedWorkerIds.length === 0
    ) {
      throw new BadRequestException(
        'assignedWorkerIds cannot be empty for SPECIFIC_WORKERS assignment type',
      );
    }

    if (
      dto.assignmentType === TaskAssignmentType.ROLE_BASED &&
      dto.assignedRoles &&
      dto.assignedRoles.length === 0
    ) {
      throw new BadRequestException(
        'assignedRoles cannot be empty for ROLE_BASED assignment type',
      );
    }

    // Update template
    const template = await this.prisma.taskTemplate.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category && { category: dto.category }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.requiresPhoto !== undefined && {
          requiresPhoto: dto.requiresPhoto,
        }),
        ...(dto.requiresComment !== undefined && {
          requiresComment: dto.requiresComment,
        }),
        ...(dto.estimatedMinutes !== undefined && {
          estimatedMinutes: dto.estimatedMinutes,
        }),
        ...(dto.assignmentType && { assignmentType: dto.assignmentType }),
        ...(dto.assignedWorkerIds !== undefined && {
          assignedWorkerIds: dto.assignedWorkerIds,
        }),
        ...(dto.assignedRoles !== undefined && {
          assignedRoles: dto.assignedRoles,
        }),
        ...(dto.daysOfWeek !== undefined && { daysOfWeek: dto.daysOfWeek }),
      },
    });

    // Log activity
    await this.logActivity(
      workerId,
      'UPDATE',
      'TASK_TEMPLATE',
      template.id,
      cafeId,
      {
        title: template.title,
        changes: JSON.parse(JSON.stringify(dto)),
      },
    );

    return this.mapTemplateToDto(template);
  }

  async deactivateTemplate(
    id: string,
    cafeId: string,
    workerId: string,
  ): Promise<TaskTemplateResponseDto> {
    // Verify template exists and belongs to cafe
    await this.getTemplateById(id, cafeId);

    // Deactivate template
    const template = await this.prisma.taskTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    // Log activity
    await this.logActivity(
      workerId,
      'UPDATE',
      'TASK_TEMPLATE',
      template.id,
      cafeId,
      {
        title: template.title,
        action: 'deactivated',
      },
    );

    return this.mapTemplateToDto(template);
  }

  // ============================================
  // Worker Task Methods
  // ============================================

  async getWorkerTasks(
    workerId: string,
    cafeId: string,
    date: string, // YYYY-MM-DD
    options?: { skipActivityLog?: boolean },
  ): Promise<WorkerTasksResponseDto> {
    const targetDate = parseDateYmd(date);
    const dayOfWeek = dayOfWeekIso(date);

    // Get worker info
    const worker = await this.prisma.workerAccount.findUnique({
      where: { id: workerId },
    });

    if (!worker) {
      throw new NotFoundException('Worker not found');
    }

    // Get active templates for cafe
    const templates = await this.prisma.taskTemplate.findMany({
      where: {
        cafeId,
        isActive: true,
        OR: [
          // ALL_WORKERS - show to everyone
          { assignmentType: TaskAssignmentType.ALL_WORKERS },
          // SPECIFIC_WORKERS - show if worker is in list
          {
            assignmentType: TaskAssignmentType.SPECIFIC_WORKERS,
            assignedWorkerIds: {
              has: workerId,
            },
          },
          // ROLE_BASED - show if worker has matching role
          {
            assignmentType: TaskAssignmentType.ROLE_BASED,
            assignedRoles: {
              has: worker.role,
            },
          },
        ],
      },
      orderBy: [{ category: 'asc' }, { priority: 'desc' }, { title: 'asc' }],
    });

    // Filter by day of week
    const filteredTemplates = templates.filter((template) => {
      // Empty daysOfWeek means every day
      if (template.daysOfWeek.length === 0) return true;
      // Check if current day is in the list
      return template.daysOfWeek.includes(dayOfWeek);
    });

    // Get completions for this worker and date
    const completions = await this.prisma.taskCompletion.findMany({
      where: {
        workerId,
        completionDate: targetDate,
        templateId: {
          in: filteredTemplates.map((t) => t.id),
        },
      },
    });

    // Create completion map for quick lookup
    const completionMap = new Map(completions.map((c) => [c.templateId, c]));

    // Merge templates with completion status
    const tasks: WorkerTaskDto[] = filteredTemplates.map((template) => {
      const completion = completionMap.get(template.id) || null;

      return {
        id: template.id,
        title: template.title,
        description: this.nullToUndefined(template.description),
        category: template.category,
        priority: template.priority,
        requiresPhoto: template.requiresPhoto,
        requiresComment: template.requiresComment,
        estimatedMinutes: this.nullToUndefined(template.estimatedMinutes),
        completed: !!completion,
        completedAt: completion?.completedAt || undefined,
        photoUrl: this.nullToUndefined(completion?.photoUrl),
        comment: this.nullToUndefined(completion?.comment),
        durationMinutes: this.nullToUndefined(completion?.durationMinutes),
      };
    });

    const completedCount = tasks.filter((t) => t.completed).length;

    if (!options?.skipActivityLog) {
      await this.logActivity(
        workerId,
        'VIEW_LIST',
        'TASK',
        cafeId,
        cafeId,
        { date, totalCount: tasks.length },
        ActivityCategory.VIEW,
      );
    }

    return {
      tasks,
      completedCount,
      totalCount: tasks.length,
      date,
    };
  }

  async getCafeDailyTaskSummary(
    cafeId: string,
    date: string,
  ): Promise<{ totalTasks: number; completedTasks: number }> {
    const workers = await this.prisma.workerAccount.findMany({
      where: { cafeId, deletedAt: null, role: WorkerRole.WORKER },
      select: { id: true },
    });

    const summaries = await Promise.all(
      workers.map((worker) =>
        this.getWorkerTasks(worker.id, cafeId, date, { skipActivityLog: true }),
      ),
    );

    return summaries.reduce(
      (acc, summary) => ({
        totalTasks: acc.totalTasks + summary.totalCount,
        completedTasks: acc.completedTasks + summary.completedCount,
      }),
      { totalTasks: 0, completedTasks: 0 },
    );
  }

  async completeTask(
    templateId: string,
    workerId: string,
    dto: CompleteTaskDto,
  ): Promise<WorkerTaskDto> {
    // Get template
    const template = await this.prisma.taskTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Task template not found');
    }

    if (!template.isActive) {
      throw new BadRequestException('Task template is not active');
    }

    // Get worker
    const worker = await this.prisma.workerAccount.findUnique({
      where: { id: workerId },
    });

    if (!worker) {
      throw new NotFoundException('Worker not found');
    }

    // Verify worker is assigned to this task
    const isAssigned =
      template.assignmentType === TaskAssignmentType.ALL_WORKERS ||
      (template.assignmentType === TaskAssignmentType.SPECIFIC_WORKERS &&
        template.assignedWorkerIds.includes(workerId)) ||
      (template.assignmentType === TaskAssignmentType.ROLE_BASED &&
        template.assignedRoles.includes(worker.role));

    if (!isAssigned) {
      throw new ForbiddenException('Task is not assigned to this worker');
    }

    // Validate required fields
    if (template.requiresPhoto && !dto.photoUrl) {
      throw new BadRequestException('Photo is required for this task');
    }

    if (template.requiresComment && !dto.comment) {
      throw new BadRequestException('Comment is required for this task');
    }

    const completionDate = parseDateYmd(dto.completionDate);

    // Create completion (unique constraint will prevent duplicates)
    try {
      const completion = await this.prisma.taskCompletion.create({
        data: {
          templateId,
          workerId,
          completionDate,
          photoUrl: dto.photoUrl,
          comment: dto.comment,
          durationMinutes: dto.durationMinutes,
        },
      });

      // Log activity
      await this.logActivity(
        workerId,
        'CREATE',
        'TASK_COMPLETION',
        completion.id,
        template.cafeId,
        {
          taskTitle: template.title,
          completionDate: dto.completionDate,
        },
      );

      // Return merged task
      return {
        id: template.id,
        title: template.title,
        description: this.nullToUndefined(template.description),
        category: template.category,
        priority: template.priority,
        requiresPhoto: template.requiresPhoto,
        requiresComment: template.requiresComment,
        estimatedMinutes: this.nullToUndefined(template.estimatedMinutes),
        completed: true,
        completedAt: completion.completedAt,
        photoUrl: this.nullToUndefined(completion.photoUrl),
        comment: this.nullToUndefined(completion.comment),
        durationMinutes: this.nullToUndefined(completion.durationMinutes),
      };
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('Task already completed for this date');
      }
      throw error;
    }
  }

  async uncompleteTask(
    templateId: string,
    workerId: string,
    date: string,
  ): Promise<void> {
    const completionDate = parseDateYmd(date);

    // Find completion
    const completion = await this.prisma.taskCompletion.findUnique({
      where: {
        templateId_workerId_completionDate: {
          templateId,
          workerId,
          completionDate,
        },
      },
      include: {
        template: true,
      },
    });

    if (!completion) {
      throw new NotFoundException('Task completion not found');
    }

    // Delete completion
    await this.prisma.taskCompletion.delete({
      where: {
        id: completion.id,
      },
    });

    // Log activity
    await this.logActivity(
      workerId,
      'DELETE',
      'TASK_COMPLETION',
      completion.id,
      completion.template.cafeId,
      {
        taskTitle: completion.template.title,
        completionDate: date,
      },
    );
  }

  // ============================================
  // Statistics Methods
  // ============================================

  async getStatistics(
    cafeId: string,
    fromDate: string,
    toDate: string,
    actorWorkerId?: string,
  ): Promise<TaskStatisticsResponseDto> {
    const { gte: from, lte: to } = dateRangeYmd(fromDate, toDate);

    // Get all completions in date range
    const completions = await this.prisma.taskCompletion.findMany({
      where: {
        template: {
          cafeId,
        },
        completionDate: {
          gte: from,
          lte: to,
        },
      },
      include: {
        template: true,
        worker: true,
      },
    });

    // Get all templates for cafe
    const templates = await this.prisma.taskTemplate.findMany({
      where: { cafeId },
    });

    // Calculate task stats
    const taskStatsMap = new Map<
      string,
      {
        templateId: string;
        templateTitle: string;
        completions: number;
        totalDuration: number;
        durationCount: number;
      }
    >();

    completions.forEach((completion) => {
      const key = completion.templateId;
      const existing = taskStatsMap.get(key) || {
        templateId: completion.templateId,
        templateTitle: completion.template.title,
        completions: 0,
        totalDuration: 0,
        durationCount: 0,
      };

      existing.completions++;
      if (completion.durationMinutes) {
        existing.totalDuration += completion.durationMinutes;
        existing.durationCount++;
      }

      taskStatsMap.set(key, existing);
    });

    const taskStats = Array.from(taskStatsMap.values()).map((stat) => ({
      templateId: stat.templateId,
      templateTitle: stat.templateTitle,
      totalCompletions: stat.completions,
      averageDurationMinutes:
        stat.durationCount > 0
          ? Math.round(stat.totalDuration / stat.durationCount)
          : undefined,
      completionRate:
        templates.length > 0
          ? Math.round((stat.completions / templates.length) * 100)
          : 0,
    }));

    // Calculate worker stats
    const workerStatsMap = new Map<
      string,
      {
        workerId: string;
        workerName: string;
        completions: number;
        totalDuration: number;
        durationCount: number;
      }
    >();

    completions.forEach((completion) => {
      const key = completion.workerId;
      const existing = workerStatsMap.get(key) || {
        workerId: completion.workerId,
        workerName: `${completion.worker.firstName} ${completion.worker.lastName}`,
        completions: 0,
        totalDuration: 0,
        durationCount: 0,
      };

      existing.completions++;
      if (completion.durationMinutes) {
        existing.totalDuration += completion.durationMinutes;
        existing.durationCount++;
      }

      workerStatsMap.set(key, existing);
    });

    const workerStats = Array.from(workerStatsMap.values()).map((stat) => ({
      workerId: stat.workerId,
      workerName: stat.workerName,
      totalCompletions: stat.completions,
      averageDurationMinutes:
        stat.durationCount > 0
          ? Math.round(stat.totalDuration / stat.durationCount)
          : undefined,
    }));

    if (actorWorkerId) {
      await this.logActivity(
        actorWorkerId,
        'VIEW_REPORT',
        'TASK_STATISTICS',
        cafeId,
        cafeId,
        { fromDate, toDate },
        ActivityCategory.VIEW,
      );
    }

    return {
      fromDate,
      toDate,
      totalCompletions: completions.length,
      totalTemplates: templates.length,
      taskStats,
      workerStats,
    };
  }

  async getTemplateCompletions(
    templateId: string,
    cafeId: string,
    fromDate: string,
    toDate: string,
    page = 1,
    pageSize = 100,
    actorWorkerId?: string,
  ): Promise<TaskCompletionHistoryResponseDto> {
    // Verify template belongs to cafe
    await this.getTemplateById(templateId, cafeId);

    const { gte: from, lte: to } = dateRangeYmd(fromDate, toDate);

    // Get total count
    const total = await this.prisma.taskCompletion.count({
      where: {
        templateId,
        completionDate: {
          gte: from,
          lte: to,
        },
      },
    });

    // Get paginated completions
    const completions = await this.prisma.taskCompletion.findMany({
      where: {
        templateId,
        completionDate: {
          gte: from,
          lte: to,
        },
      },
      include: {
        worker: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const completionHistory = completions.map((completion) => ({
      id: completion.id,
      workerId: completion.workerId,
      workerName: `${completion.worker.firstName} ${completion.worker.lastName}`,
      completedAt: completion.completedAt,
      completionDate: completion.completionDate,
      photoUrl: this.nullToUndefined(completion.photoUrl),
      comment: this.nullToUndefined(completion.comment),
      durationMinutes: this.nullToUndefined(completion.durationMinutes),
    }));

    if (actorWorkerId) {
      await this.logActivity(
        actorWorkerId,
        'VIEW_LIST',
        'TASK_COMPLETION',
        templateId,
        cafeId,
        { fromDate, toDate, page, pageSize, total },
        ActivityCategory.VIEW,
      );
    }

    return {
      completions: completionHistory,
      total,
      page,
      pageSize,
    };
  }
}
