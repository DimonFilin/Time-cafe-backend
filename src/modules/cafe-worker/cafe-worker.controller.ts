import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { CafeWorkerService } from './cafe-worker.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { AuthGuard, Unprotected } from 'nest-keycloak-connect';
import { LogActivity } from '../../common/decorators/log-activity.decorator';
import { OrderStatus, ActivityAction, ActivityCategory } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../../prisma/prisma.service';

interface RequestWithUser {
  user?: {
    cafeId?: string;
  };
}

@Controller('cafe-worker')
@UseGuards(AuthGuard)
@Unprotected()
export class CafeWorkerController {
  constructor(
    private readonly cafeWorkerService: CafeWorkerService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('orders')
  @LogActivity(ActivityAction.VIEW_LIST, ActivityCategory.VIEW, {
    resourceType: 'ORDER',
  })
  async getOrders(
    @Query('cafeId') cafeId: string,
    @Query('status') statusQuery?: string,
    @Req() req?: RequestWithUser,
  ) {
    // Проверка что работник принадлежит этому кафе (если req.user доступен)
    if (req?.user?.cafeId && req.user.cafeId !== cafeId) {
      throw new ForbiddenException('Access denied to this cafe');
    }

    const statuses = statusQuery
      ? (statusQuery.split(',') as OrderStatus[])
      : undefined;

    return this.cafeWorkerService.getOrders(cafeId, statuses);
  }

  @Get('orders/:id')
  @LogActivity(ActivityAction.VIEW_DETAIL, ActivityCategory.VIEW, {
    resourceType: 'ORDER',
  })
  async getOrderById(
    @Param('id') id: string,
    @Query('cafeId') cafeId: string,
    @Req() req?: RequestWithUser,
  ) {
    // Проверка что работник принадлежит этому кафе (если req.user доступен)
    if (req?.user?.cafeId && req.user.cafeId !== cafeId) {
      throw new ForbiddenException('Access denied to this cafe');
    }

    return this.cafeWorkerService.getOrderById(id, cafeId);
  }

  @Patch('shift-status')
  async toggleShiftStatus(
    @Req()
    req?: {
      user?: { sub?: string; id?: string };
      cookies?: { tc_account_id?: string };
      headers?: { cookie?: string };
    },
  ) {
    // Попытка получить workerId из req.user (если доступен)
    let workerId = req?.user?.id;

    // Если нет в req.user, попробуем из cookie
    if (!workerId) {
      workerId =
        req?.cookies?.tc_account_id ??
        req?.headers?.cookie
          ?.split(';')
          .map((p) => p.trim())
          .find((p) => p.startsWith('tc_account_id='))
          ?.split('=')[1];
    }

    if (!workerId) {
      throw new ForbiddenException('Worker ID not found');
    }

    return this.cafeWorkerService.toggleShiftStatus(workerId);
  }

  @Get('me')
  async getWorkerInfo(
    @Req()
    req?: {
      user?: { sub?: string; id?: string };
      cookies?: { tc_account_id?: string };
      headers?: { cookie?: string };
    },
  ) {
    // Попытка получить workerId из req.user (если доступен)
    let workerId = req?.user?.id;

    // Если нет в req.user, попробуем из cookie
    if (!workerId) {
      workerId =
        req?.cookies?.tc_account_id ??
        req?.headers?.cookie
          ?.split(';')
          .map((p) => p.trim())
          .find((p) => p.startsWith('tc_account_id='))
          ?.split('=')[1];
    }

    if (!workerId) {
      throw new ForbiddenException('Worker ID not found');
    }

    const worker = await this.prisma.workerAccount.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        shiftStatus: true,
        brandId: true,
        cafeId: true,
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
            address: true,
          },
        },
      },
    });

    if (!worker) {
      throw new ForbiddenException('Worker not found');
    }

    return worker;
  }

  @Patch('orders/:id/confirm')
  @LogActivity(ActivityAction.UPDATE, ActivityCategory.DATA, {
    resourceType: 'ORDER',
  })
  async confirmOrder(
    @Param('id') id: string,
    @Query('cafeId') cafeId: string,
    @Req() req?: RequestWithUser,
  ) {
    // Проверка что работник принадлежит этому кафе (если req.user доступен)
    if (req?.user?.cafeId && req.user.cafeId !== cafeId) {
      throw new ForbiddenException('Access denied to this cafe');
    }

    return this.cafeWorkerService.confirmOrder(id, cafeId);
  }

  @Patch('orders/:id/complete')
  @LogActivity(ActivityAction.UPDATE, ActivityCategory.DATA, {
    resourceType: 'ORDER',
  })
  async completeOrder(
    @Param('id') id: string,
    @Query('cafeId') cafeId: string,
    @Req() req?: RequestWithUser,
  ) {
    // Проверка что работник принадлежит этому кафе (если req.user доступен)
    if (req?.user?.cafeId && req.user.cafeId !== cafeId) {
      throw new ForbiddenException('Access denied to this cafe');
    }

    return this.cafeWorkerService.completeOrder(id, cafeId);
  }

  @Patch('orders/:id/cancel')
  @LogActivity(ActivityAction.UPDATE, ActivityCategory.DATA, {
    resourceType: 'ORDER',
  })
  async cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @Query('cafeId') cafeId: string,
    @Req() req?: RequestWithUser,
  ) {
    // Проверка что работник принадлежит этому кафе (если req.user доступен)
    if (req?.user?.cafeId && req.user.cafeId !== cafeId) {
      throw new ForbiddenException('Access denied to this cafe');
    }

    return this.cafeWorkerService.cancelOrder(id, cafeId, dto.reason);
  }
}
