import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { ActivityLogsService } from './activity-logs.service';
import { WorkersService } from '../workers/workers.service';
import { ActivityLogFiltersDto } from './dto/activity-log-filters.dto';
import { CreateActivityLogRequestDto } from './dto/create-activity-log-request.dto';
import { WorkerRole, LogSeverity, Prisma } from '@prisma/client';

@ApiTags('Activity Logs')
@Controller('activity-logs')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ActivityLogsController {
  constructor(
    private activityLogsService: ActivityLogsService,
    private workersService: WorkersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create activity log',
    description:
      'Creates a new activity log entry. Used for client-side actions like page navigation, modal opening, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Activity log created successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createLog(
    @Body() dto: CreateActivityLogRequestDto,
    @Request()
    req: {
      user?: {
        workerId?: string;
        email?: string;
        role?: string;
        brandId?: string;
        cafeId?: string;
      };
      ip?: string;
      headers?: { 'user-agent'?: string };
      url?: string;
      method?: string;
    },
  ): Promise<{ message: string }> {
    const user = req.user;

    if (!user || !user.workerId) {
      return { message: 'User not authenticated or not a worker' };
    }

    await this.activityLogsService.log({
      workerId: user.workerId,
      workerEmail: user.email || '',
      workerRole: (user.role as WorkerRole) || WorkerRole.WORKER,
      brandId: user.brandId,
      cafeId: user.cafeId,
      action: dto.action,
      category: dto.category,
      severity: dto.severity || LogSeverity.INFO,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      details: dto.details as Prisma.InputJsonValue,
      metadata: dto.metadata as Prisma.InputJsonValue,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
      endpoint: req.url,
      method: req.method,
    });

    return { message: 'Activity log created successfully' };
  }

  @Get()
  @ApiOperation({
    summary: 'Get activity logs',
    description:
      'Retrieves activity logs with filtering and pagination. Role-based access control applied.',
  })
  @ApiResponse({
    status: 200,
    description: 'Activity logs retrieved successfully',
  })
  async getLogs(
    @Query() filters: ActivityLogFiltersDto,
    @Request()
    req: {
      user?: { sub?: string };
      cookies?: { tc_account_id?: string };
      headers?: { cookie?: string };
    },
  ) {
    // Get selected accountId from cookie (if exists)
    const accountId =
      req.cookies?.tc_account_id ??
      req.headers?.cookie
        ?.split(';')
        .map((p) => p.trim())
        .find((p) => p.startsWith('tc_account_id='))
        ?.split('=')[1];

    // Применяем фильтры на основе роли пользователя
    const enhancedFilters = await this.applyRoleBasedFilters(
      filters,
      req.user?.sub,
      accountId,
    );
    return this.activityLogsService.getLogs(enhancedFilters);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get activity logs statistics',
    description:
      'Retrieves statistics about activity logs grouped by action, category, and severity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getStatistics(
    @Query() filters: ActivityLogFiltersDto,
    @Request()
    req: {
      user?: { sub?: string };
      cookies?: { tc_account_id?: string };
      headers?: { cookie?: string };
    },
  ) {
    const accountId =
      req.cookies?.tc_account_id ??
      req.headers?.cookie
        ?.split(';')
        .map((p) => p.trim())
        .find((p) => p.startsWith('tc_account_id='))
        ?.split('=')[1];

    const enhancedFilters = await this.applyRoleBasedFilters(
      filters,
      req.user?.sub,
      accountId,
    );
    return this.activityLogsService.getStatistics(enhancedFilters);
  }

  private async applyRoleBasedFilters(
    filters: ActivityLogFiltersDto,
    keycloakId?: string,
    accountId?: string,
  ): Promise<ActivityLogFiltersDto> {
    if (!keycloakId) {
      throw new BadRequestException('User not authenticated');
    }

    let worker: Awaited<
      ReturnType<typeof this.workersService.findById>
    > | null = null;

    if (accountId) {
      worker = await this.workersService.findById(accountId);
      if (worker && worker.keycloakId !== keycloakId) {
        throw new BadRequestException(
          'Worker account does not belong to this user',
        );
      }
    } else {
      worker = await this.workersService.findByKeycloakId(keycloakId);
    }

    if (!worker) {
      throw new BadRequestException('Worker account not found');
    }

    if (worker.role === WorkerRole.BRAND_ADMIN && worker.brandId) {
      filters.brandId = worker.brandId;
    }

    if (worker.role === WorkerRole.CAFE_ADMIN && worker.cafeId) {
      filters.cafeId = worker.cafeId;
    }

    return filters;
  }
}
