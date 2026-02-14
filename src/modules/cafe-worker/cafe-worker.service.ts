import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, LogSeverity } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class CafeWorkerService {
  constructor(
    private prisma: PrismaService,
    private activityLogsService: ActivityLogsService,
  ) {}

  // Получить заказы кафе
  async getOrders(cafeId: string, statuses?: OrderStatus[]) {
    const orders = await this.prisma.order.findMany({
      where: {
        cafeId,
        status: statuses ? { in: statuses } : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        items: {
          select: {
            id: true,
            itemName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            notes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return {
      orders,
      total: orders.length,
    };
  }

  // Получить детали заказа
  async getOrderById(orderId: string, cafeId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        cafeId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            itemName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            notes: true,
          },
        },
        transactions: {
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  // Подтвердить заказ
  async confirmOrder(orderId: string, cafeId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        cafeId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new ForbiddenException('Order cannot be confirmed');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        items: true,
      },
    });
  }

  // Завершить заказ
  async completeOrder(orderId: string, cafeId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        cafeId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'CONFIRMED') {
      throw new ForbiddenException('Order cannot be completed');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        items: true,
      },
    });
  }

  // Отменить заказ
  async cancelOrder(orderId: string, cafeId: string, reason: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        cafeId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ForbiddenException('Order cannot be cancelled');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        items: true,
      },
    });
  }

  // Переключить статус смены работника
  async toggleShiftStatus(workerId: string) {
    const worker = await this.prisma.workerAccount.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        shiftStatus: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        brandId: true,
        cafeId: true,
      },
    });

    if (!worker) {
      throw new NotFoundException('Worker not found');
    }

    const newStatus =
      worker.shiftStatus === 'ON_SHIFT' ? 'OFF_SHIFT' : 'ON_SHIFT';

    const updatedWorker = await this.prisma.workerAccount.update({
      where: { id: workerId },
      data: { shiftStatus: newStatus },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        shiftStatus: true,
      },
    });

    const message =
      newStatus === 'ON_SHIFT' ? 'Вы начали смену' : 'Вы завершили смену';

    // Создаём лог активности
    await this.activityLogsService.log({
      workerId: worker.id,
      workerEmail: worker.email,
      workerRole: worker.role,
      brandId: worker.brandId ?? undefined,
      cafeId: worker.cafeId ?? undefined,
      action: 'UPDATE',
      category: 'DATA',
      severity: LogSeverity.INFO,
      resourceType: 'WORKER',
      resourceId: worker.id,
      details: {
        shiftStatus: newStatus,
        message,
        action: newStatus === 'ON_SHIFT' ? 'START_SHIFT' : 'END_SHIFT',
        previousStatus: worker.shiftStatus,
      },
      endpoint: '/cafe-worker/shift-status',
      method: 'PATCH',
      statusCode: 200,
    });

    return {
      ...updatedWorker,
      message,
    };
  }
}
