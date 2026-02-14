import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { ActivityLogFiltersDto } from './dto/activity-log-filters.dto';
import { LogSeverity, Prisma } from '@prisma/client';

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(private prisma: PrismaService) {}

  async log(data: CreateActivityLogDto): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          workerId: data.workerId,
          workerEmail: data.workerEmail,
          workerRole: data.workerRole,
          brandId: data.brandId || undefined,
          cafeId: data.cafeId || undefined,
          action: data.action,
          category: data.category,
          severity: data.severity || LogSeverity.INFO,
          resourceType: data.resourceType || 'UNKNOWN',
          resourceId: data.resourceId,
          details: data.details as Prisma.InputJsonValue,
          metadata: data.metadata as Prisma.InputJsonValue,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          endpoint: data.endpoint,
          method: data.method,
          statusCode: data.statusCode,
          duration: data.duration,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create activity log:', error);
    }
  }

  async getLogs(filters: ActivityLogFiltersDto) {
    const {
      workerId,
      brandId,
      cafeId,
      action,
      category,
      severity,
      resourceType,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const numPage = Number(page) || 1;
    const numLimit = Number(limit) || 50;

    const where: Prisma.ActivityLogWhereInput = {};

    if (workerId) where.workerId = workerId;
    if (brandId) where.brandId = brandId;
    if (cafeId) where.cafeId = cafeId;
    if (action) where.action = action;
    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (resourceType) where.resourceType = resourceType;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orderBy: Prisma.ActivityLogOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          worker: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
            },
          },
          cafe: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy,
        skip: (numPage - 1) * numLimit,
        take: numLimit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page: numPage,
        limit: numLimit,
        totalPages: Math.ceil(total / numLimit),
      },
    };
  }

  async getStatistics(filters: ActivityLogFiltersDto) {
    const where = this.buildWhereClause(filters);

    const [byAction, byCategory, bySeverity] = await Promise.all([
      this.prisma.activityLog.groupBy({
        by: ['action'],
        where,
        _count: true,
      }),
      this.prisma.activityLog.groupBy({
        by: ['category'],
        where,
        _count: true,
      }),
      this.prisma.activityLog.groupBy({
        by: ['severity'],
        where,
        _count: true,
      }),
    ]);

    return {
      byAction,
      byCategory,
      bySeverity,
    };
  }

  private buildWhereClause(filters: ActivityLogFiltersDto) {
    const {
      workerId,
      brandId,
      cafeId,
      action,
      category,
      severity,
      resourceType,
      startDate,
      endDate,
    } = filters;

    const where: Prisma.ActivityLogWhereInput = {};

    if (workerId) where.workerId = workerId;
    if (brandId) where.brandId = brandId;
    if (cafeId) where.cafeId = cafeId;
    if (action) where.action = action;
    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (resourceType) where.resourceType = resourceType;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    return where;
  }
}
