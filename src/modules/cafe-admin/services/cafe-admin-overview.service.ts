import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderStatus, WorkerRole, WorkerShiftStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { TasksService } from '../../tasks/tasks.service';
import { CafeOverviewStatsDto } from '../dto/cafe-overview-stats.dto';

@Injectable()
export class CafeAdminOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  async getOverviewStats(
    cafeId: string,
    date?: string,
  ): Promise<CafeOverviewStatsDto> {
    const today = date ?? new Date().toISOString().slice(0, 10);
    const workerWhere = {
      cafeId,
      deletedAt: null,
      role: WorkerRole.WORKER,
    };

    const [totalWorkers, activeWorkers, taskSummary, orderStats] =
      await Promise.all([
        this.prisma.workerAccount.count({ where: workerWhere }),
        this.prisma.workerAccount.count({
          where: { ...workerWhere, shiftStatus: WorkerShiftStatus.ON_SHIFT },
        }),
        this.tasksService.getCafeDailyTaskSummary(cafeId, today),
        this.getOrderStatsForDay(cafeId, today),
      ]);

    return {
      date: today,
      activeWorkers,
      totalWorkers,
      tasksToday: taskSummary.totalTasks,
      completedTasks: taskSummary.completedTasks,
      ordersToday: orderStats.count,
      revenueToday: orderStats.revenue,
    };
  }

  private async getOrderStatsForDay(cafeId: string, dateYmd: string) {
    const from = new Date(dateYmd);
    const to = new Date(dateYmd);
    to.setHours(23, 59, 59, 999);

    const where = {
      cafeId,
      createdAt: { gte: from, lte: to },
      status: { not: OrderStatus.CANCELLED },
    };

    const [count, aggregate] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({
        where,
        _sum: { totalAmount: true },
      }),
    ]);

    const revenue = aggregate._sum.totalAmount ?? new Decimal(0);

    return {
      count,
      revenue: parseFloat(revenue.toFixed(2)),
    };
  }
}
